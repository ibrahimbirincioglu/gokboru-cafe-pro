import type { Metadata } from "next";
import Link from "next/link";
import { ProtectedShell } from "@/components/auth/protected-shell";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/server";
import { getPrisma } from "@/lib/db/prisma";
import {
  createTableAction,
  deactivateTableAction,
  rotateTableQrAction,
  updateTableAction,
} from "./actions";

export const metadata: Metadata = { title: "Masa ve QR Yönetimi" };

export default async function TablesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requirePagePermission(
    PERMISSIONS.TABLES_MANAGE,
    "/admin/tables",
  );
  const tables = await getPrisma().table.findMany({
    orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
  });
  const { error } = await searchParams;

  return (
    <ProtectedShell
      name={session.user.name}
      role={session.user.role}
      title="Masa ve QR yönetimi"
    >
      <section className="management-card">
        <div className="management-title">
          <div>
            <h2>Yeni masa</h2>
            <p className="muted">QR kod güvenli token ile otomatik oluşur.</p>
          </div>
          <Link className="button button-secondary" href="/admin/tables/print">
            Tüm QR kodlarını yazdır
          </Link>
        </div>
        {error ? (
          <p className="form-error">
            {error === "duplicate"
              ? "Bu masa numarası zaten kullanılıyor."
              : "Masa bilgileri geçersiz."}
          </p>
        ) : null}
        <form action={createTableAction} className="catalog-form">
          <label>Numara<input name="number" type="number" min="1" required /></label>
          <label>Ad<input name="name" maxLength={80} required /></label>
          <label>Sıra<input name="sortOrder" type="number" min="0" defaultValue="0" required /></label>
          <label className="checkbox-field"><input name="isActive" type="checkbox" defaultChecked /> Aktif</label>
          <button className="button button-primary" type="submit">Masa ekle</button>
        </form>
      </section>

      {tables.map((table) => (
        <section className="management-card" key={table.id}>
          <form action={updateTableAction} className="catalog-form">
            <input name="id" type="hidden" value={table.id} />
            <label>Numara<input name="number" type="number" min="1" defaultValue={table.number} required /></label>
            <label>Ad<input name="name" maxLength={80} defaultValue={table.name} required /></label>
            <label>Sıra<input name="sortOrder" type="number" min="0" defaultValue={table.sortOrder} required /></label>
            <label className="checkbox-field"><input name="isActive" type="checkbox" defaultChecked={table.isActive} /> Aktif</label>
            <button className="button button-primary" type="submit">Kaydet</button>
          </form>
          <p className="status">
            QR sürümü: {table.qrTokenVersion} · Son yenileme:{" "}
            {table.qrRotatedAt?.toLocaleString("tr-TR", {
              timeZone: "Europe/Istanbul",
            }) ?? "Henüz oluşturulmadı"}
          </p>
          <div className="management-actions">
            {table.qrTokenEncrypted ? (
              <>
                <a className="button button-secondary" href={`/admin/tables/${table.id}/qr.png`} download>PNG indir</a>
                <a className="button button-secondary" href={`/admin/tables/${table.id}/qr.svg`} download>SVG indir</a>
              </>
            ) : null}
            <form action={rotateTableQrAction}>
              <input name="id" type="hidden" value={table.id} />
              <button className="button button-secondary" type="submit">
                {table.qrTokenEncrypted ? "QR yenile" : "QR oluştur"}
              </button>
            </form>
            {table.isActive ? (
              <form action={deactivateTableAction}>
                <input name="id" type="hidden" value={table.id} />
                <button className="button button-danger" type="submit">Pasife al</button>
              </form>
            ) : null}
          </div>
        </section>
      ))}
    </ProtectedShell>
  );
}
