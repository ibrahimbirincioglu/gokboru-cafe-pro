import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthService } from "../src/lib/auth/auth-service";
import type {
  ActiveSession,
  AuthStore,
  AuthUser,
  LoginAttemptReservation,
} from "../src/lib/auth/auth-store";
import { AUTH_CONFIG } from "../src/lib/auth/config";

const NOW = new Date("2026-07-28T12:00:00.000Z");
const HASH_SECRET = "phase-2-test-secret-that-is-long-enough";

class FakeAuthStore implements AuthStore {
  reservation: LoginAttemptReservation = {
    failureCount: 1,
    blockedUntil: null,
  };
  user: AuthUser | null = {
    id: "user-1",
    name: "Test Kullanıcısı",
    username: "admin",
    passwordHash: "stored-password-hash",
    role: UserRole.ADMIN,
    isActive: true,
  };
  session: ActiveSession | null = null;
  completedLoginTokenHash: string | null = null;
  failedLoginAudits: boolean[] = [];
  clearedAttempts = 0;
  touchedSessions = 0;
  revokedSessions = 0;

  async reserveLoginAttempt() {
    return this.reservation;
  }

  async clearLoginAttempts() {
    this.clearedAttempts += 1;
  }

  async findUserByUsername() {
    return this.user;
  }

  async recordFailedLogin(
    _userId: string | null,
    rateLimited: boolean,
  ) {
    this.failedLoginAudits.push(rateLimited);
  }

  async completeLogin(input: { tokenHash: string }) {
    this.completedLoginTokenHash = input.tokenHash;
  }

  async findSessionByTokenHash() {
    return this.session;
  }

  async touchSession(
    _sessionId: string,
    lastSeenAt: Date,
    idleExpiresAt: Date,
  ) {
    this.touchedSessions += 1;
    if (this.session) {
      this.session.lastSeenAt = lastSeenAt;
      this.session.idleExpiresAt = idleExpiresAt;
    }
  }

  async revokeSession() {
    this.revokedSessions += 1;
  }
}

function activeSession(
  overrides: Partial<ActiveSession> = {},
): ActiveSession {
  return {
    id: "session-1",
    userId: "user-1",
    expiresAt: new Date(NOW.getTime() + 60 * 60 * 1000),
    idleExpiresAt: new Date(NOW.getTime() + 20 * 60 * 1000),
    lastSeenAt: new Date(NOW.getTime() - 10 * 60 * 1000),
    revokedAt: null,
    user: {
      id: "user-1",
      name: "Test Kullanıcısı",
      role: UserRole.ADMIN,
      isActive: true,
    },
    ...overrides,
  };
}

describe("AuthService login", () => {
  let store: FakeAuthStore;
  let service: AuthService;

  beforeEach(() => {
    store = new FakeAuthStore();
    service = new AuthService(store, HASH_SECRET, {
      now: () => NOW,
      passwordVerifier: async (_hash, password) =>
        password === "dogru-parola",
    });
  });

  it("creates a hashed session for a valid enabled user", async () => {
    const result = await service.login({
      username: "ADMIN",
      password: "dogru-parola",
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.user.role).toBe(UserRole.ADMIN);
    expect(result.expiresAt.getTime() - NOW.getTime()).toBe(
      AUTH_CONFIG.sessionAbsoluteDurationMs,
    );
    expect(store.completedLoginTokenHash).toHaveLength(64);
    expect(store.completedLoginTokenHash).not.toBe(result.token);
    expect(store.clearedAttempts).toBe(1);
  });

  it("returns a generic error for a wrong password", async () => {
    const result = await service.login({
      username: "admin",
      password: "yanlis-parola",
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({
      ok: false,
      reason: "INVALID_CREDENTIALS",
    });
    expect(store.completedLoginTokenHash).toBeNull();
    expect(store.failedLoginAudits).toEqual([false]);
  });

  it("denies inactive users without revealing their state", async () => {
    store.user = { ...store.user!, isActive: false };

    const result = await service.login({
      username: "admin",
      password: "dogru-parola",
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({
      ok: false,
      reason: "INVALID_CREDENTIALS",
    });
  });

  it("denies KITCHEN because it is outside the requested login scope", async () => {
    store.user = { ...store.user!, role: UserRole.KITCHEN };

    const result = await service.login({
      username: "kitchen",
      password: "dogru-parola",
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({
      ok: false,
      reason: "INVALID_CREDENTIALS",
    });
  });

  it("blocks attempts after the configured threshold", async () => {
    store.reservation = {
      failureCount: AUTH_CONFIG.loginMaxAttempts + 1,
      blockedUntil: new Date(
        NOW.getTime() + AUTH_CONFIG.loginBlockDurationMs,
      ),
    };

    const result = await service.login({
      username: "admin",
      password: "dogru-parola",
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({ ok: false, reason: "RATE_LIMITED" });
    expect(store.completedLoginTokenHash).toBeNull();
    expect(store.failedLoginAudits).toEqual([true]);
  });
});

describe("AuthService session management", () => {
  let store: FakeAuthStore;
  let service: AuthService;

  beforeEach(() => {
    store = new FakeAuthStore();
    service = new AuthService(store, HASH_SECRET, { now: () => NOW });
  });

  it("accepts and periodically extends an active session", async () => {
    store.session = activeSession();

    const result = await service.validateSession("valid-token");

    expect(result?.id).toBe("session-1");
    expect(store.touchedSessions).toBe(1);
    expect(result?.idleExpiresAt.getTime()).toBe(
      NOW.getTime() + AUTH_CONFIG.sessionIdleDurationMs,
    );
  });

  it("revokes expired sessions", async () => {
    store.session = activeSession({
      expiresAt: new Date(NOW.getTime() - 1),
    });

    await expect(
      service.validateSession("expired-token"),
    ).resolves.toBeNull();
    expect(store.revokedSessions).toBe(1);
  });

  it("rejects already revoked sessions without another write", async () => {
    store.session = activeSession({ revokedAt: NOW });

    await expect(
      service.validateSession("revoked-token"),
    ).resolves.toBeNull();
    expect(store.revokedSessions).toBe(0);
  });

  it("revokes the current session on logout", async () => {
    store.session = activeSession();

    await service.logout("valid-token");

    expect(store.revokedSessions).toBe(1);
  });
});
