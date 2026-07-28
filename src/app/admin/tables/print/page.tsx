import type { Metadata } from "next";
import Link from "next/link";
import { PrintButton } from "@/components/qr/print-button";
import { qrDataUrl } from "@/features/qr/image";
import { qrPublicUrl, tokenFromEncrypted } from "@/features/qr/server";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/server";
import { getPrisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Yazdırılabilir Masa QR Kodları" };

export default async function TableQrPrintPage() {
  await requirePagePermission(PERMISSIONS.TABLES_MANAGE, "/admin/tables/print");
  const tables = await getPrisma().table.findMany({
    where: { qrTokenEncrypted: { not: null } },
    orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
    select: {
      id: true,
      name: true,
      number: true,
      qrTokenEncrypted: true,
    },
  });
  const printable = await Promise.all(
    tables.map(async (table) => {
      const token = tokenFromEncrypted(table.qrTokenEncrypted!);
      return {
        ...table,
        image: await qrDataUrl(qrPublicUrl(token)),
      };
    }),
  );

  return (
    <main className="print-shell">
      <div className="print-toolbar">
        <Link className="button button-secondary" href="/admin/tables">
          Masa yönetimine dön
        </Link>
        <PrintButton />
      </div>
      <div className="qr-print-grid">
        {printable.map((table) => (
          <article className="qr-print-card" key={table.id}>
            {/* QR is generated server-side from an authenticated, encrypted token. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- printable QR must preserve its data URL exactly */}
            <img alt={`${table.name} QR kodu`} src={table.image} />
            <h1>{table.name}</h1>
            <p>Masa {table.number} · Menüyü açmak için okutun</p>
          </article>
        ))}
      </div>
    </main>
  );
}
