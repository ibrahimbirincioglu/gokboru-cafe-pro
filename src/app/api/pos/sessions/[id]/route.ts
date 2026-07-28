import { NextResponse } from "next/server";
import { getPosSession } from "@/features/pos/queries";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireServerPermission } from "@/lib/auth/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await requireServerPermission(PERMISSIONS.PAYMENTS_TAKE);
  const { id } = await context.params;
  const session = await getPosSession(id);
  if (!session) {
    return NextResponse.json({ error: "Açık masa bulunamadı." }, { status: 404 });
  }
  return NextResponse.json(session, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
