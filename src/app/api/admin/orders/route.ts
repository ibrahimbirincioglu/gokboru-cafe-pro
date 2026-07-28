import { NextResponse } from "next/server";
import { getLiveDashboard } from "@/features/orders/dashboard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireServerPermission } from "@/lib/auth/server";

export async function GET() {
  await requireServerPermission(PERMISSIONS.ORDERS_MANAGE);
  return NextResponse.json(await getLiveDashboard(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
