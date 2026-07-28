import Link from "next/link";
import { notFound } from "next/navigation";
import { getReceipt } from "@/features/pos/queries";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/server";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  await requirePagePermission(
    PERMISSIONS.PAYMENTS_TAKE,
    `/pos/receipt/${paymentId}`,
  );
  const payment = await getReceipt(paymentId);
  if (!payment || payment.status !== "COMPLETED") notFound();
  return (
    <main className="receipt">
      <header>
        <p className="eyebrow">GÖKBÖRÜ CAFE</p>
        <h1>Ödeme Fişi</h1>
        <p>{payment.paymentNumber}</p>
        <p>{payment.tableSession.table.name}</p>
        <p>{payment.paidAt?.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</p>
      </header>
      {payment.tableSession.orders.map((order, index) => (
        <section key={order.id}>
          <h2>Tur {index + 1} · {order.orderNumber}</h2>
          {order.items.map((item) => {
            const quantity = item.quantity - item.cancelledQuantity;
            if (quantity <= 0) return null;
            return (
              <div className="receipt-line" key={item.id}>
                <span>{quantity}× {item.productNameSnapshot}</span>
                <span>₺{item.unitPriceSnapshot.mul(quantity).toFixed(2)}</span>
                {!!item.selectedOptions.length && (
                  <small>{item.selectedOptions.map((entry) => entry.optionNameSnapshot).join(", ")}</small>
                )}
              </div>
            );
          })}
        </section>
      ))}
      <dl className="receipt-totals">
        <dt>Ara toplam</dt><dd>₺{payment.subtotal.toFixed(2)}</dd>
        <dt>İndirim</dt><dd>₺{payment.discountTotal.toFixed(2)}</dd>
        <dt>Toplam</dt><dd>₺{payment.amount.toFixed(2)}</dd>
        <dt>Ödeme</dt>
        <dd>{payment.paymentType === "NAKIT" ? "Nakit" : "Kredi kartı"}</dd>
        <dt>Kasiyer</dt><dd>{payment.receivedBy.name}</dd>
      </dl>
      <nav className="receipt-actions">
        <span>Yazdırmak için Ctrl+P kullanın.</span>
        <Link className="button button-secondary" href="/pos">Açık masalar</Link>
      </nav>
    </main>
  );
}
