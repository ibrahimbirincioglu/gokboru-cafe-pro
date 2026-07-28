import "server-only";

import { Prisma, TableSessionStatus } from "@prisma/client";
import type { LiveDashboardDto } from "./live-types";
import { getPrisma } from "@/lib/db/prisma";

const ACTIVE_SESSION_STATUSES = [
  TableSessionStatus.OPEN,
  TableSessionStatus.PAYMENT_REQUESTED,
  TableSessionStatus.PAYMENT_PROCESSING,
];

export async function getLiveDashboard(): Promise<LiveDashboardDto> {
  const [orders, tables] = await Promise.all([
    getPrisma().order.findMany({
      where: { status: { notIn: ["IPTAL"] } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        table: { select: { name: true } },
        items: {
          orderBy: { createdAt: "asc" },
          include: { selectedOptions: true },
        },
      },
    }),
    getPrisma().table.findMany({
      orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
      include: {
        tableSessions: {
          where: { status: { in: ACTIVE_SESSION_STATUSES } },
          take: 1,
          include: {
            orders: {
              where: { status: { not: "IPTAL" } },
              orderBy: { createdAt: "desc" },
              select: { total: true, createdAt: true },
            },
          },
        },
      },
    }),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    orders: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      version: order.version,
      tableName: order.table.name,
      total: order.total.toFixed(2),
      customerNote: order.customerNote,
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        name: item.productNameSnapshot,
        quantity: item.quantity,
        note: item.note,
        options: item.selectedOptions.map(
          (option) => option.optionNameSnapshot,
        ),
      })),
    })),
    tables: tables.map((table) => {
      const session = table.tableSessions[0];
      const grossOpenTotal = (session?.orders ?? []).reduce(
        (total, order) => total.add(order.total),
        new Prisma.Decimal(0),
      );
      const openTotal = session
        ? Prisma.Decimal.max(
            grossOpenTotal.sub(session.discountTotal),
            new Prisma.Decimal(0),
          )
        : grossOpenTotal;
      return {
        id: table.id,
        name: table.name,
        number: table.number,
        state: !table.isActive ? "PASIF" : session ? "DOLU" : "BOS",
        openTotal: openTotal.toFixed(2),
        lastOrderAt: session?.orders[0]?.createdAt.toISOString() ?? null,
        paymentRequested:
          session?.status === TableSessionStatus.PAYMENT_REQUESTED ||
          session?.status === TableSessionStatus.PAYMENT_PROCESSING,
      };
    }),
  };
}
