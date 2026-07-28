import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hashQrToken } from "@/features/qr/crypto";
import { publicQrTokenSchema } from "@/features/qr/validation";
import { getPrisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Sipariş Takibi" };
export const dynamic = "force-dynamic";

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ publicOrderToken: string }>;
}) {
  const parsed = publicQrTokenSchema.safeParse((await params).publicOrderToken);
  if (!parsed.success) notFound();
  const order = await getPrisma().order.findUnique({
    where: { publicTokenHash: hashQrToken(parsed.data) },
    include: {
      table: { select: { name: true } },
      items: {
        include: { selectedOptions: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!order) notFound();

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">{order.table.name} · {order.orderNumber}</p>
        <h1>Siparişiniz alındı</h1>
        <p className="lead">Durum: <strong>{order.status}</strong></p>
        <div className="tracking-items">
          {order.items.map((item) => (
            <div key={item.id}>
              <strong>{item.quantity} × {item.productNameSnapshot}</strong>
              <span>{item.lineSubtotal.toFixed(2)} TL</span>
              {item.selectedOptions.length ? (
                <small>{item.selectedOptions.map((option) => option.optionNameSnapshot).join(", ")}</small>
              ) : null}
            </div>
          ))}
        </div>
        <p className="lead">Toplam: <strong>{order.total.toFixed(2)} TL</strong></p>
        <p className="status">Bu güvenli bağlantıyı sipariş durumunu tekrar görmek için saklayın.</p>
      </section>
    </main>
  );
}
