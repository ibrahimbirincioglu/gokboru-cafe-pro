import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/server";

export async function GET() {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json(
      { error: { code: "AUTH_REQUIRED", message: "Oturum gerekli." } },
      { status: 401 },
    );
  }

  return NextResponse.json({
    user: {
      id: session.user.id,
      name: session.user.name,
      role: session.user.role,
    },
  });
}
