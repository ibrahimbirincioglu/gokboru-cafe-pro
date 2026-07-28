import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  AuthenticationRequiredError,
  AuthorizationDeniedError,
  requireServerPermission,
} from "@/lib/auth/server";

export async function GET() {
  try {
    const session = await requireServerPermission(
      PERMISSIONS.ADMIN_ACCESS,
    );

    return NextResponse.json({
      user: {
        id: session.user.id,
        name: session.user.name,
        role: session.user.role,
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        {
          error: {
            code: "AUTH_REQUIRED",
            message: "Oturum gerekli.",
          },
        },
        { status: 401 },
      );
    }

    if (error instanceof AuthorizationDeniedError) {
      return NextResponse.json(
        {
          error: {
            code: "PERMISSION_DENIED",
            message: "Bu işlem için yetkiniz yok.",
          },
        },
        { status: 403 },
      );
    }

    throw error;
  }
}
