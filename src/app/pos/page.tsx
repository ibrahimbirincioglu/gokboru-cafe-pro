import type { Metadata } from "next";
import { ProtectedShell } from "@/components/auth/protected-shell";
import { PosBoard } from "@/components/pos/pos-board";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Kasa" };

export default async function PosPage() {
  const session = await requirePagePermission(PERMISSIONS.POS_ACCESS, "/pos");
  return (
    <ProtectedShell
      name={session.user.name}
      role={session.user.role}
      title="Kasa · Açık Masalar"
    >
      <PosBoard />
    </ProtectedShell>
  );
}
