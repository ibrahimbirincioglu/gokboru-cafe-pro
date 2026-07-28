import { NextResponse } from "next/server";
import { getPublicOrderTracking } from "@/features/orders/tracking";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicOrderToken: string }> },
) {
  const order = await getPublicOrderTracking((await params).publicOrderToken);
  if (!order) {
    return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  }
  return NextResponse.json(order, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
