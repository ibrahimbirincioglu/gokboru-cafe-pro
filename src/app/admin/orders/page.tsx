import type { Metadata } from "next";
import { LiveOrdersBoard } from "@/components/orders/live-orders-board";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Canlı Siparişler" };

export default async function AdminOrdersPage() {
  await requirePagePermission(PERMISSIONS.ORDERS_MANAGE, "/admin/orders");
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Gökbörü Cafe</p>
          <h1>Canlı siparişler</h1>
        </div>
      </header>
      <LiveOrdersBoard />
    </main>
  );
}
