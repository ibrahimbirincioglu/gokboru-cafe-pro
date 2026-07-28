import "server-only";

import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { assertDate, istanbulUtcRange } from "./dates";
import type { HistoryFilters } from "./validation";

const REPORT_PAYMENT_STATUSES = ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"] as const;

type SummaryRow = {
  net: Prisma.Decimal | null;
  cash: Prisma.Decimal | null;
  card: Prisma.Decimal | null;
  discounts: Prisma.Decimal | null;
  refunds: Prisma.Decimal | null;
  table_count: bigint;
};
type CountRow = { order_count: bigint };
type ProductRow = { name: string; quantity: bigint; revenue: Prisma.Decimal };
type HourRow = { hour: number; payment_count: bigint; revenue: Prisma.Decimal };
type CancelRow = { cancellations: Prisma.Decimal | null };

export async function getRevenueReport(from: string, to: string) {
  assertDate(from);
  assertDate(to);
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T00:00:00.000Z`);
  const prisma = getPrisma();
  const statusSql = Prisma.sql`('COMPLETED','PARTIALLY_REFUNDED','REFUNDED')`;
  const [summaryRows, orderRows, productRows, hourRows, cancelRows] =
    await Promise.all([
      prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
        SELECT
          COALESCE(SUM("amount" - "refundedAmount"), 0) AS net,
          COALESCE(SUM(CASE WHEN "paymentType"='NAKIT' THEN "amount" - "refundedAmount" ELSE 0 END), 0) AS cash,
          COALESCE(SUM(CASE WHEN "paymentType"='KREDI_KARTI' THEN "amount" - "refundedAmount" ELSE 0 END), 0) AS card,
          COALESCE(SUM("discountTotal"), 0) AS discounts,
          COALESCE(SUM("refundedAmount"), 0) AS refunds,
          COUNT(DISTINCT "tableSessionId") AS table_count
        FROM "Payment"
        WHERE "businessDate" BETWEEN ${fromDate} AND ${toDate}
          AND "status" IN ${statusSql}
      `),
      prisma.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(DISTINCT o."id") AS order_count
        FROM "Order" o
        JOIN "Payment" p ON p."tableSessionId"=o."tableSessionId"
        WHERE p."businessDate" BETWEEN ${fromDate} AND ${toDate}
          AND p."status" IN ${statusSql}
      `),
      prisma.$queryRaw<ProductRow[]>(Prisma.sql`
        SELECT oi."productNameSnapshot" AS name,
          SUM(oi."quantity" - oi."cancelledQuantity")::bigint AS quantity,
          SUM(oi."unitPriceSnapshot" * (oi."quantity" - oi."cancelledQuantity")) AS revenue
        FROM "OrderItem" oi
        JOIN "Order" o ON o."id"=oi."orderId"
        JOIN "Payment" p ON p."tableSessionId"=o."tableSessionId"
        WHERE p."businessDate" BETWEEN ${fromDate} AND ${toDate}
          AND p."status" IN ${statusSql}
          AND oi."quantity" > oi."cancelledQuantity"
        GROUP BY oi."productNameSnapshot"
        ORDER BY quantity DESC, revenue DESC
        LIMIT 10
      `),
      prisma.$queryRaw<HourRow[]>(Prisma.sql`
        SELECT DATE_PART(
          'hour',
          "paidAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Istanbul'
        )::int AS hour,
          COUNT(*)::bigint AS payment_count,
          SUM("amount" - "refundedAmount") AS revenue
        FROM "Payment"
        WHERE "businessDate" BETWEEN ${fromDate} AND ${toDate}
          AND "status" IN ${statusSql} AND "paidAt" IS NOT NULL
        GROUP BY hour ORDER BY payment_count DESC, revenue DESC, hour ASC
      `),
      prisma.$queryRaw<CancelRow[]>(Prisma.sql`
        SELECT COALESCE(SUM(oi."unitPriceSnapshot" * oi."cancelledQuantity"), 0) AS cancellations
        FROM "OrderItem" oi
        JOIN "Order" o ON o."id"=oi."orderId"
        JOIN "Payment" p ON p."tableSessionId"=o."tableSessionId"
        WHERE p."businessDate" BETWEEN ${fromDate} AND ${toDate}
          AND p."status" IN ${statusSql}
      `),
    ]);
  const summary = summaryRows[0]!;
  const net = summary.net ?? new Prisma.Decimal(0);
  const tableCount = Number(summary.table_count);
  return {
    from,
    to,
    net: net.toFixed(2),
    cash: (summary.cash ?? new Prisma.Decimal(0)).toFixed(2),
    card: (summary.card ?? new Prisma.Decimal(0)).toFixed(2),
    discounts: (summary.discounts ?? new Prisma.Decimal(0)).toFixed(2),
    cancellations: (cancelRows[0]?.cancellations ?? new Prisma.Decimal(0)).toFixed(2),
    refunds: (summary.refunds ?? new Prisma.Decimal(0)).toFixed(2),
    orderCount: Number(orderRows[0]?.order_count ?? BigInt(0)),
    averageTable: tableCount ? net.div(tableCount).toFixed(2) : "0.00",
    tableCount,
    topProducts: productRows.map((row) => ({
      name: row.name,
      quantity: Number(row.quantity),
      revenue: row.revenue.toFixed(2),
    })),
    busyHours: hourRows.map((row) => ({
      hour: `${String(row.hour).padStart(2, "0")}:00`,
      paymentCount: Number(row.payment_count),
      revenue: row.revenue.toFixed(2),
    })),
  };
}

export function historyWhere(filters: HistoryFilters): Prisma.OrderWhereInput {
  const range = istanbulUtcRange(filters.from, filters.to);
  let gte = range.gte;
  let lt = range.lt;
  if (filters.timeFrom) gte = new Date(`${filters.from}T${filters.timeFrom}:00+03:00`);
  if (filters.timeTo) lt = new Date(`${filters.to}T${filters.timeTo}:59.999+03:00`);
  return {
    createdAt: { gte, lt },
    ...(filters.tableId ? { tableId: filters.tableId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.productId ? { items: { some: { productId: filters.productId } } } : {}),
    ...(filters.paymentType
      ? {
          tableSession: {
            payments: {
              some: {
                paymentType: filters.paymentType,
                status: { in: [...REPORT_PAYMENT_STATUSES] },
              },
            },
          },
        }
      : {}),
    ...(filters.employeeId
      ? {
          OR: [
            { createdByUserId: filters.employeeId },
            {
              tableSession: {
                payments: {
                  some: {
                    receivedByUserId: filters.employeeId,
                    status: { in: [...REPORT_PAYMENT_STATUSES] },
                  },
                },
              },
            },
          ],
        }
      : {}),
  };
}

export async function getOrderHistory(filters: HistoryFilters, take = 50) {
  const where = historyWhere(filters);
  const [orders, total] = await Promise.all([
    getPrisma().order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * take,
      take,
      include: {
        table: { select: { name: true } },
        createdBy: { select: { name: true } },
        items: { orderBy: { createdAt: "asc" }, include: { selectedOptions: true } },
        tableSession: {
          include: {
            payments: {
              where: { status: { in: [...REPORT_PAYMENT_STATUSES] } },
              select: {
                paymentType: true,
                amount: true,
                refundedAmount: true,
                receivedBy: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    getPrisma().order.count({ where }),
  ]);
  return { orders, total, page: filters.page, pageSize: take };
}

export async function getReportFilters() {
  const [tables, products, employees] = await Promise.all([
    getPrisma().table.findMany({ orderBy: { number: "asc" }, select: { id: true, name: true } }),
    getPrisma().product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getPrisma().user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
  ]);
  return { tables, products, employees };
}
