export const GUEST_SESSION_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Host-gokboru_guest"
    : "gokboru_guest";

export const GUEST_SESSION_DURATION_MS = 12 * 60 * 60 * 1000;
