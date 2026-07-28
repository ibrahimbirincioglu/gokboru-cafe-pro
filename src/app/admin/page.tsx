import type { Metadata } from "next";
import Link from "next/link";
import { ProtectedShell } from "@/components/auth/protected-shell";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Yönetim Paneli",
};

export default async function AdminPage() {
  const session = await requirePagePermission(
    PERMISSIONS.ADMIN_ACCESS,
    "/admin",
  );

  return (
    <ProtectedShell
      name={session.user.name}
      role={session.user.role}
      title="Yönetim paneli"
    >
      <p className="muted">
        Kimlik ve yetki sistemi etkin. Menü yönetimi kullanıma hazır.
      </p>
      <div className="management-actions">
        <Link className="button button-primary" href="/admin/menu">
          Menü yönetimini aç
        </Link>
        <Link className="button button-secondary" href="/admin/tables">
          Masa ve QR yönetimini aç
        </Link>
        <Link className="button button-primary" href="/admin/orders">
          Canlı siparişleri aç
        </Link>
        <Link className="button button-secondary" href="/admin/reports">
          Ciro ve sipariş geçmişi
        </Link>
      </div>
    </ProtectedShell>
  );
}
