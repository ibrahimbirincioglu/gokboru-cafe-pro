import { NextResponse } from "next/server";
import { completePayment, PosOperationError } from "@/features/pos/service";
import { paymentSchema } from "@/features/pos/validation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireServerPermission } from "@/lib/auth/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireServerPermission(PERMISSIONS.PAYMENTS_TAKE);
  try {
    const input = paymentSchema.parse(await request.json());
    const { id } = await context.params;
    return NextResponse.json(await completePayment(id, auth.user.id, input));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof PosOperationError ? error.message : "Ödeme tamamlanamadı." },
      { status: 400 },
    );
  }
}
