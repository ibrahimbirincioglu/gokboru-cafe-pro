import type { Metadata } from "next";
import { ProtectedShell } from "@/components/auth/protected-shell";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Garson",
};

export default async function WaiterPage() {
  const session = await requirePagePermission(
    PERMISSIONS.WAITER_ACCESS,
    "/waiter",
  );

  return (
    <ProtectedShell
      name={session.user.name}
      role={session.user.role}
      title="Garson erişimi"
    >
      <p className="muted">
        Garson sayfası rol kontrolüyle korunuyor. Sipariş özellikleri
        sonraki aşamalardadır.
      </p>
    </ProtectedShell>
  );
}
