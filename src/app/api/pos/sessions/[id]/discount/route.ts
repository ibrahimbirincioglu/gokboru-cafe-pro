import { NextResponse } from "next/server";
import { applySessionDiscount, PosOperationError } from "@/features/pos/service";
import { discountSchema } from "@/features/pos/validation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireServerPermission } from "@/lib/auth/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireServerPermission(PERMISSIONS.ORDERS_ADJUST);
  try {
    const input = discountSchema.parse(await request.json());
    const { id } = await context.params;
    await applySessionDiscount(id, auth.user.id, input);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof PosOperationError ? error.message : "Geçersiz indirim isteği." },
      { status: 400 },
    );
  }
}
