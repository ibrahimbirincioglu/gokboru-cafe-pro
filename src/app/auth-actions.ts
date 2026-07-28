"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth/config";
import { getAuthService } from "@/lib/auth/server";

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await getAuthService().logout(token);
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/admin/login");
}
