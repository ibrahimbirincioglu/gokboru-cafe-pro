import Link from "next/link";
import { ProtectedShell } from "@/components/auth/protected-shell";
import { reportRange } from "@/features/reports/dates";
import { getOrderHistory, getReportFilters, getRevenueReport } from "@/features/reports/service";
import { historyFilterSchema } from "@/features/reports/validation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/server";

type Params = Record<string, string | string[] | undefined>;
const get = (params: Params, key: string) =>
  typeof params[key] === "string" ? params[key] : undefined;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const auth = await requirePagePermission(PERMISSIONS.REPORTS_VIEW, "/admin/reports");
  const params = await searchParams;
  let range;
  try {
    range = reportRange(get(params, "preset"), get(params, "from"), get(params, "to"));
  } catch {
    range = reportRange("day", undefined, undefined);
  }
  const parsed = historyFilterSchema.safeParse({
    from: range.from, to: range.to,
    timeFrom: get(params, "timeFrom") ?? "", timeTo: get(params, "timeTo") ?? "",
    tableId: get(params, "tableId") ?? "", productId: get(params, "productId") ?? "",
    status: get(params, "status") ?? "", paymentType: get(params, "paymentType") ?? "",
    employeeId: get(params, "employeeId") ?? "", page: get(params, "page") ?? "1",
  });
  const filters = parsed.success
    ? parsed.data
    : historyFilterSchema.parse({ from: range.from, to: range.to });
  const [report, history, options] = await Promise.all([
    getRevenueReport(range.from, range.to), getOrderHistory(filters), getReportFilters(),
  ]);
  const exportParams = new URLSearchParams(
    Object.entries(filters).map(([key, item]) => [key, String(item)]),
  );
  const pageHref = (page: number) => {
    const query = new URLSearchParams(exportParams);
    query.set("page", String(page));
    query.set("preset", "custom");
    return `?${query}`;
  };
  return (
    <ProtectedShell name={auth.user.name} role={auth.user.role} title="Ciro ve Sipariş Geçmişi">
      <nav className="report-presets">
        <Link className="button button-secondary" href="/admin/reports?preset=day">Günlük</Link>
        <Link className="button button-secondary" href="/admin/reports?preset=week">Haftalık</Link>
        <Link className="button button-secondary" href="/admin/reports?preset=month">Aylık</Link>
      </nav>
      <form className="report-filter" method="get">
        <input type="hidden" name="preset" value="custom" />
        <label>Başlangıç<input type="date" name="from" defaultValue={range.from} required /></label>
        <label>Bitiş<input type="date" name="to" defaultValue={range.to} required /></label>
        <button className="button" type="submit">Özel aralığı göster</button>
      </form>
      <p className="muted">{report.from} — {report.to} · Europe/Istanbul işletme günü</p>
      <section className="report-metrics">
        {[
          ["Net ciro", `₺${report.net}`], ["Nakit", `₺${report.cash}`],
          ["Kart", `₺${report.card}`], ["İndirim", `₺${report.discounts}`],
          ["İptal", `₺${report.cancellations}`], ["İade", `₺${report.refunds}`],
          ["Sipariş", report.orderCount], ["Ortalama masa", `₺${report.averageTable}`],
        ].map(([label, metric]) => (
          <article className="report-card" key={label}><span>{label}</span><strong>{metric}</strong></article>
        ))}
      </section>
      <div className="report-columns">
        <ReportTable title="En çok satan ürünler" headings={["Ürün", "Adet", "Tutar"]}
          rows={report.topProducts.map((item) => [item.name, item.quantity, `₺${item.revenue}`])} />
        <ReportTable title="Yoğun saatler" headings={["Saat", "Ödeme", "Ciro"]}
          rows={report.busyHours.map((item) => [item.hour, item.paymentCount, `₺${item.revenue}`])} />
      </div>
      <h2>Sipariş geçmişi</h2>
      <form className="history-filter" method="get">
        <input type="hidden" name="preset" value="custom" />
        <label>Tarih başlangıç<input type="date" name="from" defaultValue={filters.from} /></label>
        <label>Tarih bitiş<input type="date" name="to" defaultValue={filters.to} /></label>
        <label>Saat başlangıç<input type="time" name="timeFrom" defaultValue={filters.timeFrom} /></label>
        <label>Saat bitiş<input type="time" name="timeTo" defaultValue={filters.timeTo} /></label>
        <Select label="Masa" name="tableId" value={filters.tableId} options={options.tables} />
        <Select label="Ürün" name="productId" value={filters.productId} options={options.products} />
        <Select label="Durum" name="status" value={filters.status}
          options={["BEKLIYOR","ONAYLANDI","HAZIRLANIYOR","HAZIR","TAMAMLANDI","IPTAL"].map((id) => ({ id, name: id }))} />
        <Select label="Ödeme" name="paymentType" value={filters.paymentType}
          options={[{ id: "NAKIT", name: "Nakit" }, { id: "KREDI_KARTI", name: "Kredi kartı" }]} />
        <Select label="Çalışan" name="employeeId" value={filters.employeeId}
          options={options.employees.map((item) => ({ id: item.id, name: `${item.name} · ${item.role}` }))} />
        <button className="button" type="submit">Filtrele</button>
        <Link className="button button-secondary" href={`/api/admin/reports/orders.csv?${exportParams}`}>CSV indir</Link>
      </form>
      <p className="muted">{history.total} sipariş bulundu.</p>
      <div className="history-list">
        {history.orders.map((order) => (
          <details className="history-order" key={order.id}>
            <summary><strong>{order.orderNumber}</strong> · {order.table.name} ·{" "}
              {order.createdAt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} · {order.status}
            </summary>
            <p>Ödeme: {order.tableSession.payments.map((payment) => payment.paymentType).join(" + ") || "—"}</p>
            <p>Çalışan: {order.createdBy?.name ?? order.tableSession.payments[0]?.receivedBy.name ?? "—"}</p>
            {order.items.map((item) => (
              <div className="history-item" key={item.id}>
                <span>{item.quantity - item.cancelledQuantity}× {item.productNameSnapshot}</span>
                <span>₺{item.unitPriceSnapshot.toFixed(2)}</span>
                {!!item.selectedOptions.length && <small>{item.selectedOptions.map((option) => option.optionNameSnapshot).join(", ")}</small>}
                {item.cancelReason && <small>İptal: {item.cancelReason}</small>}
              </div>
            ))}
          </details>
        ))}
      </div>
      <nav className="report-presets">
        {filters.page > 1 && <Link className="button button-secondary" href={pageHref(filters.page - 1)}>Önceki</Link>}
        {filters.page * history.pageSize < history.total && <Link className="button button-secondary" href={pageHref(filters.page + 1)}>Sonraki</Link>}
      </nav>
    </ProtectedShell>
  );
}

function ReportTable({ title, headings, rows }: { title: string; headings: string[]; rows: Array<Array<string | number>> }) {
  return <section><h2>{title}</h2><table><thead><tr>{headings.map((item) => <th key={item}>{item}</th>)}</tr></thead>
    <tbody>{rows.map((row) => <tr key={row.join("|")}>{row.map((item, index) => <td key={index}>{item}</td>)}</tr>)}</tbody></table></section>;
}

function Select({ label, name, value, options }: {
  label: string; name: string; value: string; options: Array<{ id: string; name: string }>;
}) {
  return <label>{label}<select name={name} defaultValue={value}><option value="">Tümü</option>
    {options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
}
