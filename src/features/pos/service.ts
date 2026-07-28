import "server-only";

import { randomUUID } from "node:crypto";
import {
  OrderSource,
  PaymentStatus,
  Prisma,
  TableSessionStatus,
} from "@prisma/client";
import { priceOrder, type CatalogProduct } from "@/features/orders/pricing";
import { businessDateForIstanbul } from "@/features/orders/time";
import { getPrisma } from "@/lib/db/prisma";
import { publishOrderEvent } from "@/lib/realtime/events";
import { calculateSessionTotals } from "./money";
import type {
  cashierOrderSchema,
  cancelItemSchema,
  discountSchema,
  paymentSchema,
} from "./validation";
import type { z } from "zod";

type CashierOrderInput = z.infer<typeof cashierOrderSchema>;
type CancelInput = z.infer<typeof cancelItemSchema>;
type DiscountInput = z.infer<typeof discountSchema>;
type PaymentInput = z.infer<typeof paymentSchema>;

export class PosOperationError extends Error {}

const txOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

async function lockSession(tx: Prisma.TransactionClient, sessionId: string) {
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${sessionId}))`,
  );
  const session = await tx.tableSession.findUnique({
    where: { id: sessionId },
    include: {
      table: { select: { id: true } },
      orders: {
        where: { status: { not: "IPTAL" } },
        include: { items: true },
      },
    },
  });
  if (
    !session ||
    !(<TableSessionStatus[]>[
      TableSessionStatus.OPEN,
      TableSessionStatus.PAYMENT_REQUESTED,
      TableSessionStatus.PAYMENT_PROCESSING,
    ]).includes(session.status)
  ) {
    throw new PosOperationError("Açık masa oturumu bulunamadı.");
  }
  return session;
}

export async function addCashierOrder(
  sessionId: string,
  actorUserId: string,
  input: CashierOrderInput,
) {
  const prisma = getPrisma();
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { id: true, tableSessionId: true, orderNumber: true },
  });
  if (existing) return validateExistingOrder(existing, sessionId);

  const result = await prisma.$transaction(async (tx) => {
    const session = await lockSession(tx, sessionId);
    if (session.status !== TableSessionStatus.OPEN) {
      throw new PosOperationError("Ödeme sürecindeki masaya ürün eklenemez.");
    }
    const duplicate = await tx.order.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { id: true, tableSessionId: true, orderNumber: true },
    });
    if (duplicate) return validateExistingOrder(duplicate, sessionId);
    const products = await tx.product.findMany({
      where: { id: { in: input.items.map((item) => item.productId) } },
      include: {
        category: { select: { isActive: true } },
        optionGroups: { include: { options: true } },
      },
    });
    const catalog: CatalogProduct[] = products.map((product) => ({
      ...product,
      categoryActive: product.category.isActive,
    }));
    const priced = priceOrder(input, catalog);
    const order = await tx.order.create({
      data: {
        orderNumber: `KASA-${randomUUID()}`,
        tableSessionId: session.id,
        tableId: session.table.id,
        createdByUserId: actorUserId,
        idempotencyKey: input.idempotencyKey,
        status: "ONAYLANDI",
        source: OrderSource.CASHIER,
        subtotal: priced.subtotal,
        discountTotal: priced.discountTotal,
        total: priced.total,
        customerNote: input.customerNote || null,
        acceptedAt: new Date(),
        items: {
          create: priced.items.map((item) => ({
            productId: item.productId,
            productNameSnapshot: item.productNameSnapshot,
            unitPriceSnapshot: item.unitPriceSnapshot,
            quantity: item.quantity,
            lineSubtotal: item.lineSubtotal,
            note: item.note,
            prepStation: item.prepStation,
            status: "ONAYLANDI",
            selectedOptions: { create: item.selectedOptions },
          })),
        },
        statusHistory: {
          create: {
            toStatus: "ONAYLANDI",
            source: OrderSource.CASHIER,
            changedByUserId: actorUserId,
            note: "Kasa tarafından eklendi.",
          },
        },
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "CASHIER_ORDER_CREATED",
        entityType: "Order",
        entityId: order.id,
        safeMetadata: {
          tableSessionId: sessionId,
          itemCount: priced.items.length,
        },
      },
    });
    return { id: order.id, orderNumber: order.orderNumber, duplicate: false };
  }, txOptions);
  if (!result.duplicate) publishOrderEvent("ORDER_CREATED", result.id);
  return result;
}

function validateExistingOrder(
  order: { id: string; tableSessionId: string; orderNumber: string },
  sessionId: string,
) {
  if (order.tableSessionId !== sessionId) {
    throw new PosOperationError("Idempotency anahtarı başka işleme ait.");
  }
  return { id: order.id, orderNumber: order.orderNumber, duplicate: true };
}

export async function cancelOrderItem(
  sessionId: string,
  actorUserId: string,
  input: CancelInput,
) {
  const result = await getPrisma().$transaction(async (tx) => {
    const session = await lockSession(tx, sessionId);
    if (session.status !== TableSessionStatus.OPEN) {
      throw new PosOperationError("Ödeme sürecinde iptal yapılamaz.");
    }
    const item = session.orders
      .flatMap((order) => order.items)
      .find((candidate) => candidate.id === input.itemId);
    if (!item) throw new PosOperationError("Sipariş kalemi bulunamadı.");
    const remaining = item.quantity - item.cancelledQuantity;
    if (input.quantity > remaining) {
      throw new PosOperationError("İptal miktarı kalan miktarı aşamaz.");
    }
    const cancelledQuantity = item.cancelledQuantity + input.quantity;
    await tx.orderItem.update({
      where: { id: item.id },
      data: {
        cancelledQuantity,
        cancelReason: input.reason,
        ...(cancelledQuantity === item.quantity ? { status: "IPTAL" } : {}),
      },
    });
    const order = session.orders.find((candidate) => candidate.id === item.orderId)!;
    const cancelledTotal = order.items.reduce(
      (sum, candidate) =>
        sum.add(
          candidate.unitPriceSnapshot.mul(
            candidate.id === item.id
              ? cancelledQuantity
              : candidate.cancelledQuantity,
          ),
        ),
      new Prisma.Decimal(0),
    );
    await tx.order.update({
      where: { id: order.id },
      data: {
        cancelledTotal,
        total: order.items
          .reduce(
            (sum, candidate) =>
              sum.add(
                candidate.unitPriceSnapshot.mul(
                  candidate.quantity -
                    (candidate.id === item.id
                      ? cancelledQuantity
                      : candidate.cancelledQuantity),
                ),
              ),
            new Prisma.Decimal(0),
          ),
        version: { increment: 1 },
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "ORDER_ITEM_CANCELLED",
        entityType: "OrderItem",
        entityId: item.id,
        beforeJson: { cancelledQuantity: item.cancelledQuantity },
        afterJson: { cancelledQuantity, reason: input.reason },
        safeMetadata: { tableSessionId: sessionId, orderId: order.id },
      },
    });
    return order.id;
  }, txOptions);
  publishOrderEvent("ORDER_STATUS_CHANGED", result);
}

export async function applySessionDiscount(
  sessionId: string,
  actorUserId: string,
  input: DiscountInput,
) {
  const orderIds = await getPrisma().$transaction(async (tx) => {
    const session = await lockSession(tx, sessionId);
    if (session.status !== TableSessionStatus.OPEN) {
      throw new PosOperationError("Ödeme sürecinde indirim değiştirilemez.");
    }
    const amount = new Prisma.Decimal(input.amount);
    calculateSessionTotals(
      session.orders.flatMap((order) => order.items),
      amount,
    );
    await tx.tableSession.update({
      where: { id: sessionId },
      data: {
        discountTotal: amount,
        discountReason: input.reason,
        discountByUserId: actorUserId,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "TABLE_SESSION_DISCOUNT_APPLIED",
        entityType: "TableSession",
        entityId: sessionId,
        beforeJson: { discountTotal: session.discountTotal.toFixed(2) },
        afterJson: { discountTotal: amount.toFixed(2), reason: input.reason },
      },
    });
    return session.orders.map((order) => order.id);
  }, txOptions);
  orderIds.forEach((id) => publishOrderEvent("ORDER_STATUS_CHANGED", id));
}

export async function completePayment(
  sessionId: string,
  actorUserId: string,
  input: PaymentInput,
) {
  const prisma = getPrisma();
  const existing = await prisma.payment.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) return validateExistingPayment(existing, sessionId, actorUserId);

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${sessionId}))`,
    );
    const duplicate = await tx.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (duplicate) {
      return {
        ...validateExistingPayment(duplicate, sessionId, actorUserId),
        orderIds: [] as string[],
      };
    }
    const session = await lockSession(tx, sessionId);
    const totals = calculateSessionTotals(
      session.orders.flatMap((order) => order.items),
      session.discountTotal,
    );
    if (!totals.amount.greaterThan(0)) {
      throw new PosOperationError("Ödenecek tutar sıfırdan büyük olmalıdır.");
    }
    const now = new Date();
    const payment = await tx.payment.create({
      data: {
        paymentNumber: `ODEME-${randomUUID()}`,
        tableSessionId: sessionId,
        subtotal: totals.subtotal,
        discountTotal: totals.discount,
        amount: totals.amount,
        paymentType: input.paymentType,
        status: PaymentStatus.COMPLETED,
        idempotencyKey: input.idempotencyKey,
        receivedByUserId: actorUserId,
        businessDate: businessDateForIstanbul(now),
        paidAt: now,
      },
    });
    for (const order of session.orders) {
      if (order.status !== "TAMAMLANDI") {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "TAMAMLANDI",
            completedAt: now,
            version: { increment: 1 },
            items: {
              updateMany: {
                where: { status: { not: "IPTAL" } },
                data: { status: "SERVIS_EDILDI" },
              },
            },
          },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: order.status,
            toStatus: "TAMAMLANDI",
            changedByUserId: actorUserId,
            source: OrderSource.CASHIER,
            note: "Ödeme ile tamamlandı.",
          },
        });
      }
    }
    await tx.tableSession.update({
      where: { id: sessionId },
      data: {
        status: TableSessionStatus.CLOSED,
        closedAt: now,
        closedByUserId: actorUserId,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "PAYMENT_COMPLETED_AND_TABLE_CLOSED",
        entityType: "Payment",
        entityId: payment.id,
        safeMetadata: {
          tableSessionId: sessionId,
          subtotal: totals.subtotal.toFixed(2),
          discountTotal: totals.discount.toFixed(2),
          amount: totals.amount.toFixed(2),
          paymentType: input.paymentType,
        },
      },
    });
    return {
      paymentId: payment.id,
      paymentNumber: payment.paymentNumber,
      duplicate: false,
      orderIds: session.orders.map((order) => order.id),
    };
  }, txOptions);
  result.orderIds.forEach((id) =>
    publishOrderEvent("ORDER_STATUS_CHANGED", id),
  );
  return result;
}

function validateExistingPayment(
  payment: {
    id: string;
    paymentNumber: string;
    tableSessionId: string;
    receivedByUserId: string;
    status: PaymentStatus;
  },
  sessionId: string,
  actorUserId: string,
) {
  if (
    payment.tableSessionId !== sessionId ||
    payment.receivedByUserId !== actorUserId ||
    payment.status !== PaymentStatus.COMPLETED
  ) {
    throw new PosOperationError("Idempotency anahtarı başka işleme ait.");
  }
  return {
    paymentId: payment.id,
    paymentNumber: payment.paymentNumber,
    duplicate: true,
  };
}
