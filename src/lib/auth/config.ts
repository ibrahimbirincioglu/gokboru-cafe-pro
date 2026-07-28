import { UserRole } from "@prisma/client";

export const AUTH_CONFIG = {
  sessionAbsoluteDurationMs: 8 * 60 * 60 * 1000,
  sessionIdleDurationMs: 30 * 60 * 1000,
  sessionTouchIntervalMs: 5 * 60 * 1000,
  loginWindowMs: 15 * 60 * 1000,
  loginBlockDurationMs: 15 * 60 * 1000,
  loginMaxAttempts: 5,
} as const;

export const LOGIN_ENABLED_ROLES = new Set<UserRole>([
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.CASHIER,
  UserRole.WAITER,
]);

export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Host-gokboru_session"
    : "gokboru_session";
