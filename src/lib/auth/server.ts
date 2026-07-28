import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db/prisma";
import { AuthService } from "./auth-service";
import { PrismaAuthStore } from "./auth-store";
import { SESSION_COOKIE_NAME } from "./config";
import {
  defaultRouteForRole,
  hasPermission,
  type Permission,
} from "./permissions";

export class AuthenticationRequiredError extends Error {}
export class AuthorizationDeniedError extends Error {}

function getHashSecret() {
  const secret = process.env.AUTH_HASH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("AUTH_HASH_SECRET en az 32 karakter olmalıdır.");
  }

  return secret;
}

export function getAuthService() {
  return new AuthService(
    new PrismaAuthStore(getPrisma()),
    getHashSecret(),
  );
}

export async function getClientContext() {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const ipAddress =
    forwardedFor?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown";

  return {
    ipAddress,
    userAgent: requestHeaders.get("user-agent") || "unknown",
  };
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return getAuthService().validateSession(token);
}

export async function requirePagePermission(
  permission: Permission,
  returnPath: string,
) {
  const session = await getCurrentSession();

  if (!session) {
    redirect(
      `/admin/login?next=${encodeURIComponent(returnPath)}`,
    );
  }

  if (!hasPermission(session.user.role, permission)) {
    redirect("/forbidden");
  }

  return session;
}

export async function requireServerPermission(permission: Permission) {
  const session = await getCurrentSession();

  if (!session) {
    throw new AuthenticationRequiredError("Oturum gerekli.");
  }

  if (!hasPermission(session.user.role, permission)) {
    throw new AuthorizationDeniedError("Bu işlem için yetkiniz yok.");
  }

  return session;
}

export async function redirectAuthenticatedUser() {
  const session = await getCurrentSession();

  if (session) {
    redirect(defaultRouteForRole(session.user.role));
  }
}
