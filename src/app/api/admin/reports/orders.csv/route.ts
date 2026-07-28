import { NextResponse } from "next/server";
import { csvRow } from "@/features/reports/csv";
import { getOrderHistory } from "@/features/reports/service";
import { historyFilterSchema } from "@/features/reports/validation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireServerPermission } from "@/lib/auth/server";

export async function GET(request: Request) {
  await requireServerPermission(PERMISSIONS.REPORTS_VIEW);
  const url = new URL(request.url);
  const parsed = historyFilterSchema.safeParse({
    ...Object.fromEntries(url.searchParams),
    page: 1,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz rapor filtresi." }, { status: 400 });
  }
  const result = await getOrderHistory(parsed.data, 5_000);
  const rows = [
    csvRow(["Sipariş No", "Tarih", "Saat", "Masa", "Ürün", "Adet", "Durum", "Ödeme Tipi", "Siparişi Giren", "Ödemeyi Alan"]),
  ];
  for (const order of result.orders) {
    const local = order.createdAt.toLocaleString("tr-TR", {
      timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit",
      day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const [date, time] = local.split(" ");
    const types = order.tableSession.payments.map((payment) => payment.paymentType).join("+");
    const cashiers = order.tableSession.payments.map((payment) => payment.receivedBy.name).join(", ");
    for (const item of order.items) {
      rows.push(csvRow([
        order.orderNumber, date, time, order.table.name, item.productNameSnapshot,
        item.quantity - item.cancelledQuantity, order.status, types,
        order.createdBy?.name ?? "", cashiers,
      ]));
    }
  }
  return new NextResponse(`\uFEFF${rows.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="siparis-gecmisi-${parsed.data.from}-${parsed.data.to}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
