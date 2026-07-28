import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { GUEST_SESSION_COOKIE } from "@/features/guest-session/config";
import { validateGuestSession } from "@/features/guest-session/server";
import { createGuestOrder, OrderCreationError } from "@/features/orders/service";
import { createOrderInputSchema } from "@/features/orders/validation";
import { OrderPricingError } from "@/features/orders/pricing";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl || (origin && origin !== new URL(appUrl).origin)) {
    return NextResponse.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }
  const parsed = createOrderInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Sipariş bilgileri geçersiz." }, { status: 400 });
  }
  const cookieStore = await cookies();
  const guest = await validateGuestSession(
    cookieStore.get(GUEST_SESSION_COOKIE)?.value,
    parsed.data.qrToken,
  );
  if (!guest) {
    return NextResponse.json(
      { error: "Misafir oturumu geçersiz veya süresi dolmuş." },
      { status: 401 },
    );
  }
  try {
    const order = await createGuestOrder({
      request: parsed.data,
      guestSessionId: guest.session.id,
      tableId: guest.table.id,
    });
    return NextResponse.json({
      orderNumber: order.orderNumber,
      trackingPath: `/order/${order.publicToken}`,
      duplicate: order.duplicate,
    });
  } catch (error) {
    if (error instanceof OrderPricingError || error instanceof OrderCreationError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
