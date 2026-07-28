import "server-only";

import { TableSessionStatus } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { calculateSessionTotals } from "./money";

const ACTIVE: TableSessionStatus[] = [
  TableSessionStatus.OPEN,
  TableSessionStatus.PAYMENT_REQUESTED,
  TableSessionStatus.PAYMENT_PROCESSING,
];

export async function getOpenSessions() {
  const sessions = await getPrisma().tableSession.findMany({
    where: { status: { in: ACTIVE } },
    orderBy: { openedAt: "asc" },
    include: {
      table: { select: { name: true, number: true } },
      orders: {
        where: { status: { not: "IPTAL" } },
        orderBy: { createdAt: "desc" },
        include: { items: true },
      },
    },
  });
  return {
    generatedAt: new Date().toISOString(),
    sessions: sessions.map((session) => {
      const totals = calculateSessionTotals(
        session.orders.flatMap((order) => order.items),
        session.discountTotal,
      );
      return {
        id: session.id,
        tableName: session.table.name,
        tableNumber: session.table.number,
        status: session.status,
        roundCount: session.orders.length,
        openedAt: session.openedAt.toISOString(),
        lastOrderAt: session.orders[0]?.createdAt.toISOString() ?? null,
        subtotal: totals.subtotal.toFixed(2),
        discountTotal: totals.discount.toFixed(2),
        amount: totals.amount.toFixed(2),
      };
    }),
  };
}

export async function getPosSession(id: string) {
  const session = await getPrisma().tableSession.findUnique({
    where: { id },
    include: {
      table: { select: { name: true, number: true } },
      orders: {
        orderBy: { createdAt: "asc" },
        include: {
          items: {
            orderBy: { createdAt: "asc" },
            include: { selectedOptions: true },
          },
        },
      },
    },
  });
  if (!session || !ACTIVE.includes(session.status)) return null;
  const totals = calculateSessionTotals(
    session.orders
      .filter((order) => order.status !== "IPTAL")
      .flatMap((order) => order.items),
    session.discountTotal,
  );
  const categories = await getPrisma().category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      products: {
        where: { isActive: true, isAvailable: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          optionGroups: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            include: {
              options: {
                where: { isActive: true },
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      },
    },
  });
  return {
    id: session.id,
    tableName: session.table.name,
    status: session.status,
    discountReason: session.discountReason,
    totals: {
      subtotal: totals.subtotal.toFixed(2),
      discountTotal: totals.discount.toFixed(2),
      amount: totals.amount.toFixed(2),
    },
    orders: session.orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      source: order.source,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        name: item.productNameSnapshot,
        quantity: item.quantity,
        cancelledQuantity: item.cancelledQuantity,
        unitPrice: item.unitPriceSnapshot.toFixed(2),
        note: item.note,
        options: item.selectedOptions.map((option) => option.optionNameSnapshot),
      })),
    })),
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      products: category.products.map((product) => ({
        id: product.id,
        name: product.name,
        price: (product.discountPrice ?? product.price).toFixed(2),
        allowNote: product.allowNote,
        optionGroups: product.optionGroups.map((group) => ({
          id: group.id,
          name: group.name,
          required: group.required,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          options: group.options.map((option) => ({
            id: option.id,
            name: option.name,
            priceDelta: option.priceDelta.toFixed(2),
          })),
        })),
      })),
    })),
  };
}

export async function getReceipt(paymentId: string) {
  return getPrisma().payment.findUnique({
    where: { id: paymentId },
    include: {
      receivedBy: { select: { name: true } },
      tableSession: {
        include: {
          table: { select: { name: true } },
          orders: {
            orderBy: { createdAt: "asc" },
            include: {
              items: {
                orderBy: { createdAt: "asc" },
                include: { selectedOptions: true },
              },
            },
          },
        },
      },
    },
  });
}
