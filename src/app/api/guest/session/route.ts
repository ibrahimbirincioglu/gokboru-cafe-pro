import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createGuestSession,
  validateGuestSession,
} from "@/features/guest-session/server";
import { GUEST_SESSION_COOKIE } from "@/features/guest-session/config";
import { publicQrTokenSchema } from "@/features/qr/validation";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl || (origin && origin !== new URL(appUrl).origin)) {
    return NextResponse.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const parsed = publicQrTokenSchema.safeParse(body?.qrToken);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz QR kodu." }, { status: 400 });
  }
  const cookieStore = await cookies();
  const currentToken = cookieStore.get(GUEST_SESSION_COOKIE)?.value;
  const current = await validateGuestSession(currentToken, parsed.data);
  if (current) {
    return NextResponse.json({
      table: { name: current.table.name, number: current.table.number },
    });
  }
  const result = await createGuestSession(parsed.data);
  if (!result) {
    return NextResponse.json({ error: "QR kodu aktif değil." }, { status: 404 });
  }
  const response = NextResponse.json({
    table: { name: result.table.name, number: result.table.number },
  });
  response.cookies.set(GUEST_SESSION_COOKIE, result.rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: result.expiresAt,
  });
  return response;
}
