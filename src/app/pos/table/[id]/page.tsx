import { notFound } from "next/navigation";
import { ProtectedShell } from "@/components/auth/protected-shell";
import { PosTable } from "@/components/pos/pos-table";
import { getPosSession } from "@/features/pos/queries";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/server";

export default async function PosTablePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const auth = await requirePagePermission(
    PERMISSIONS.PAYMENTS_TAKE,
    `/pos/table/${id}`,
  );
  const session = await getPosSession(id);
  if (!session) notFound();
  return (
    <ProtectedShell
      name={auth.user.name}
      role={auth.user.role}
      title={`Kasa · ${session.tableName}`}
    >
      <PosTable
        initialSession={session}
        canAdjust={hasPermission(auth.user.role, PERMISSIONS.ORDERS_ADJUST)}
      />
    </ProtectedShell>
  );
}
