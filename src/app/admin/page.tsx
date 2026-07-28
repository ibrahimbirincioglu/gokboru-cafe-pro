import type { Metadata } from "next";
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
        Kimlik ve yetki sistemi etkin. Yönetim özellikleri sonraki
        aşamalarda eklenecektir.
      </p>
    </ProtectedShell>
  );
}
