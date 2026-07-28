"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  defaultRouteForRole,
} from "@/lib/auth/permissions";
import {
  getAuthService,
  getClientContext,
} from "@/lib/auth/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/config";
import { safeReturnPath } from "@/lib/auth/validation";

export async function loginAction(formData: FormData) {
  const username = formData.get("username");
  const password = formData.get("password");
  const returnPath = safeReturnPath(formData.get("next"));

  if (typeof username !== "string" || typeof password !== "string") {
    redirect("/admin/login?error=invalid");
  }

  const result = await getAuthService().login({
    username,
    password,
    ...(await getClientContext()),
  });

  if (!result.ok) {
    const error =
      result.reason === "RATE_LIMITED" ? "rate-limited" : "invalid";
    redirect(`/admin/login?error=${error}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: result.expiresAt,
    priority: "high",
  });

  redirect(returnPath ?? defaultRouteForRole(result.user.role));
}
