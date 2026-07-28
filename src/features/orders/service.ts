import "server-only";

import { randomUUID } from "node:crypto";
import { OrderSource, Prisma, TableSessionStatus } from "@prisma/client";
import { createStoredQrToken, decryptQrToken } from "@/features/qr/crypto";
import { getQrSecret } from "@/features/qr/server";
import { getPrisma } from "@/lib/db/prisma";
import { publishOrderEvent } from "@/lib/realtime/events";
import { priceOrder, type CatalogProduct } from "./pricing";
import { businessDateForIstanbul } from "./time";
import type { CreateOrderInput } from "./validation";

const ACTIVE_SESSION_STATUSES = [
  TableSessionStatus.OPEN,
  TableSessionStatus.PAYMENT_REQUESTED,
  TableSessionStatus.PAYMENT_PROCESSING,
];

export class OrderCreationError extends Error {}

export async function createGuestOrder(input: {
  request: CreateOrderInput;
  guestSessionId: string;
  tableId: string;
}) {
  const prisma = getPrisma();
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: input.request.idempotencyKey },
    select: {
      id: true,
      orderNumber: true,
      guestSessionId: true,
      publicTokenEncrypted: true,
    },
  });
  if (existing) {
    return existingOrderResult(existing, input.guestSessionId);
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw(
            Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${input.tableId}))`,
          );
          const now = new Date();
          const liveGuest = await tx.guestSession.findUnique({
            where: { id: input.guestSessionId },
            include: {
              table: {
                select: {
                  id: true,
                  isActive: true,
                  qrTokenVersion: true,
                },
              },
            },
          });
          if (
            !liveGuest ||
            liveGuest.expiresAt <= now ||
            liveGuest.tableId !== input.tableId ||
            !liveGuest.table.isActive ||
            liveGuest.qrTokenVersion !== liveGuest.table.qrTokenVersion
          ) {
            throw new OrderCreationError("Misafir oturumu artık geçerli değil.");
          }
          const duplicate = await tx.order.findUnique({
            where: { idempotencyKey: input.request.idempotencyKey },
            select: {
              id: true,
              orderNumber: true,
              guestSessionId: true,
              publicTokenEncrypted: true,
            },
          });
          if (duplicate) {
            return existingOrderResult(duplicate, input.guestSessionId);
          }
          const products = await tx.product.findMany({
            where: {
              id: { in: input.request.items.map((item) => item.productId) },
            },
            include: {
              category: { select: { isActive: true } },
              optionGroups: {
                include: { options: true },
              },
            },
          });
          const catalog: CatalogProduct[] = products.map((product) => ({
            ...product,
            categoryActive: product.category.isActive,
          }));
          const recentOrderCount = await tx.order.count({
            where: {
              guestSessionId: input.guestSessionId,
              createdAt: { gte: new Date(now.getTime() - 60_000) },
            },
          });
          if (recentOrderCount >= 5) {
            throw new OrderCreationError(
              "Çok hızlı sipariş gönderildi. Lütfen kısa süre sonra tekrar deneyin.",
            );
          }
          const priced = priceOrder(input.request, catalog);
          let tableSession = await tx.tableSession.findFirst({
            where: {
              tableId: input.tableId,
              status: { in: ACTIVE_SESSION_STATUSES },
            },
          });
          if (tableSession && tableSession.status !== TableSessionStatus.OPEN) {
            throw new OrderCreationError(
              "Bu masa için ödeme süreci başladığından yeni sipariş alınamaz.",
            );
          }
          if (!tableSession) {
            tableSession = await tx.tableSession.create({
              data: {
                tableId: input.tableId,
                businessDate: businessDateForIstanbul(new Date()),
              },
            });
          }
          const publicToken = createStoredQrToken(getQrSecret());
          const order = await tx.order.create({
            data: {
              orderNumber: `QR-${randomUUID()}`,
              tableSessionId: tableSession.id,
              tableId: input.tableId,
              guestSessionId: input.guestSessionId,
              idempotencyKey: input.request.idempotencyKey,
              publicTokenHash: publicToken.hash,
              publicTokenEncrypted: publicToken.encrypted,
              source: OrderSource.QR,
              subtotal: priced.subtotal,
              discountTotal: priced.discountTotal,
              total: priced.total,
              customerNote: input.request.customerNote || null,
              items: {
                create: priced.items.map((item) => ({
                  productId: item.productId,
                  productNameSnapshot: item.productNameSnapshot,
                  unitPriceSnapshot: item.unitPriceSnapshot,
                  quantity: item.quantity,
                  lineSubtotal: item.lineSubtotal,
                  note: item.note,
                  prepStation: item.prepStation,
                  selectedOptions: {
                    create: item.selectedOptions,
                  },
                })),
              },
              statusHistory: {
                create: {
                  toStatus: "BEKLIYOR",
                  source: OrderSource.QR,
                },
              },
            },
          });
          await tx.auditLog.create({
            data: {
              action: "GUEST_ORDER_CREATED",
              entityType: "Order",
              entityId: order.id,
              safeMetadata: {
                tableId: input.tableId,
                tableSessionId: tableSession.id,
                itemCount: priced.items.length,
                source: "QR",
              },
            },
          });
          return {
            id: order.id,
            orderNumber: order.orderNumber,
            publicToken: publicToken.token,
            duplicate: false,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      if (!result.duplicate) {
        publishOrderEvent("ORDER_CREATED", result.id);
      }
      return result;
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" || error.code === "P2002");
      if (retryable) {
        const duplicate = await prisma.order.findUnique({
          where: { idempotencyKey: input.request.idempotencyKey },
          select: {
            id: true,
            orderNumber: true,
            guestSessionId: true,
            publicTokenEncrypted: true,
          },
        });
        if (duplicate) {
          return existingOrderResult(duplicate, input.guestSessionId);
        }
        if (attempt < 2) continue;
      }
      throw error;
    }
  }
  throw new OrderCreationError("Sipariş oluşturulamadı.");
}

function existingOrderResult(
  order: {
    id: string;
    orderNumber: string;
    guestSessionId: string | null;
    publicTokenEncrypted: string | null;
  },
  guestSessionId: string,
) {
  if (
    order.guestSessionId !== guestSessionId ||
    !order.publicTokenEncrypted
  ) {
    throw new OrderCreationError("Idempotency anahtarı başka isteğe ait.");
  }
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    publicToken: decryptQrToken(order.publicTokenEncrypted, getQrSecret()),
    duplicate: true,
  };
}
