import type { Metadata } from "next";
import { ProtectedShell } from "@/components/auth/protected-shell";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Kasa",
};

export default async function PosPage() {
  const session = await requirePagePermission(
    PERMISSIONS.POS_ACCESS,
    "/pos",
  );

  return (
    <ProtectedShell
      name={session.user.name}
      role={session.user.role}
      title="Kasa erişimi"
    >
      <p className="muted">
        Kasa sayfası rol kontrolüyle korunuyor. Ödeme özellikleri Aşama
        7 kapsamındadır.
      </p>
    </ProtectedShell>
  );
}
