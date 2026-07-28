import { NextResponse } from "next/server";
import { getOpenSessions } from "@/features/pos/queries";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireServerPermission } from "@/lib/auth/server";

export async function GET() {
  await requireServerPermission(PERMISSIONS.PAYMENTS_TAKE);
  return NextResponse.json(await getOpenSessions(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
