import Link from "next/link";
import { ProtectedShell } from "@/components/auth/protected-shell";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/server";

export default async function MenuManagementPage() {
  const session = await requirePagePermission(
    PERMISSIONS.MENU_MANAGE,
    "/admin/menu",
  );

  return (
    <ProtectedShell
      name={session.user.name}
      role={session.user.role}
      title="Menü yönetimi"
    >
      <nav className="management-links" aria-label="Menü yönetimi">
        <Link className="button button-primary" href="/admin/menu/categories">
          Kategoriler
        </Link>
        <Link className="button button-primary" href="/admin/menu/products">
          Ürünler ve seçenekler
        </Link>
      </nav>
    </ProtectedShell>
  );
}
