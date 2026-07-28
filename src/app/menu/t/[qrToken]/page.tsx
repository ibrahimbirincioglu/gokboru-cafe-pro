import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveActiveTableByQrToken } from "@/features/qr/server";

export const metadata: Metadata = { title: "Masa QR Doğrulama" };

export default async function PublicTableQrPage({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  const table = await resolveActiveTableByQrToken((await params).qrToken);
  if (!table) notFound();

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">QR doğrulandı</p>
        <h1>{table.name}</h1>
        <p className="lead">
          Bu QR kodu aktif masaya güvenli biçimde bağlıdır. Müşteri menüsü ve
          sipariş akışı sonraki aşamada eklenecektir.
        </p>
      </section>
    </main>
  );
}
