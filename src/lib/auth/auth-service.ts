import { AUTH_CONFIG, LOGIN_ENABLED_ROLES } from "./config";
import {
  type ActiveSession,
  type AuthStore,
  type AuthUser,
} from "./auth-store";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "./password";
import {
  createSessionToken,
  hashSensitiveIdentifier,
  hashSessionToken,
} from "./tokens";
import { loginInputSchema } from "./validation";

type LoginSuccess = {
  ok: true;
  token: string;
  expiresAt: Date;
  user: Pick<AuthUser, "id" | "name" | "role">;
};

type LoginFailure = {
  ok: false;
  reason: "INVALID_CREDENTIALS" | "RATE_LIMITED";
};

export type LoginResult = LoginSuccess | LoginFailure;

export type LoginRequest = {
  username: string;
  password: string;
  ipAddress: string;
  userAgent: string;
};

type AuthServiceOptions = {
  now?: () => Date;
  passwordVerifier?: (
    passwordHash: string,
    password: string,
  ) => Promise<boolean>;
};

export class AuthService {
  private readonly now: () => Date;
  private readonly passwordVerifier: NonNullable<
    AuthServiceOptions["passwordVerifier"]
  >;

  constructor(
    private readonly store: AuthStore,
    private readonly hashSecret: string,
    options: AuthServiceOptions = {},
  ) {
    if (hashSecret.length < 32) {
      throw new Error("AUTH_HASH_SECRET en az 32 karakter olmalıdır.");
    }

    this.now = options.now ?? (() => new Date());
    this.passwordVerifier = options.passwordVerifier ?? verifyPassword;
  }

  async login(request: LoginRequest): Promise<LoginResult> {
    const parsed = loginInputSchema.safeParse({
      username: request.username,
      password: request.password,
    });

    if (!parsed.success) {
      return { ok: false, reason: "INVALID_CREDENTIALS" };
    }

    const now = this.now();
    const identifierHash = hashSensitiveIdentifier(
      parsed.data.username,
      this.hashSecret,
    );
    const ipHash = hashSensitiveIdentifier(
      request.ipAddress || "unknown",
      this.hashSecret,
    );
    const reservation = await this.store.reserveLoginAttempt({
      identifierHash,
      ipHash,
      now,
    });

    if (
      reservation.blockedUntil &&
      reservation.blockedUntil > now &&
      reservation.failureCount > AUTH_CONFIG.loginMaxAttempts
    ) {
      await this.store.recordFailedLogin(null, true);
      return { ok: false, reason: "RATE_LIMITED" };
    }

    const user = await this.store.findUserByUsername(parsed.data.username);
    const passwordMatches = await this.passwordVerifier(
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
      parsed.data.password,
    );
    const canLogin =
      user &&
      user.isActive &&
      LOGIN_ENABLED_ROLES.has(user.role) &&
      passwordMatches;

    if (!canLogin) {
      await this.store.recordFailedLogin(user?.id ?? null, false);
      return { ok: false, reason: "INVALID_CREDENTIALS" };
    }

    await this.store.clearLoginAttempts(identifierHash, ipHash);

    const { token, tokenHash } = createSessionToken();
    const expiresAt = new Date(
      now.getTime() + AUTH_CONFIG.sessionAbsoluteDurationMs,
    );
    const idleExpiresAt = new Date(
      now.getTime() + AUTH_CONFIG.sessionIdleDurationMs,
    );
    const userAgentHash = hashSensitiveIdentifier(
      request.userAgent || "unknown",
      this.hashSecret,
    );

    await this.store.completeLogin({
      user,
      tokenHash,
      ipHash,
      userAgentHash,
      expiresAt,
      idleExpiresAt,
      now,
    });

    return {
      ok: true,
      token,
      expiresAt,
      user: { id: user.id, name: user.name, role: user.role },
    };
  }

  async validateSession(rawToken: string): Promise<ActiveSession | null> {
    if (!rawToken || rawToken.length > 200) {
      return null;
    }

    const now = this.now();
    const session = await this.store.findSessionByTokenHash(
      hashSessionToken(rawToken),
    );

    if (!session) {
      return null;
    }

    const invalid =
      session.revokedAt !== null ||
      session.expiresAt <= now ||
      session.idleExpiresAt <= now ||
      !session.user.isActive ||
      !LOGIN_ENABLED_ROLES.has(session.user.role);

    if (invalid) {
      if (!session.revokedAt) {
        await this.store.revokeSession(
          session.id,
          session.userId,
          now,
        );
      }
      return null;
    }

    if (
      now.getTime() - session.lastSeenAt.getTime() >=
      AUTH_CONFIG.sessionTouchIntervalMs
    ) {
      const idleExpiresAt = new Date(
        Math.min(
          session.expiresAt.getTime(),
          now.getTime() + AUTH_CONFIG.sessionIdleDurationMs,
        ),
      );
      await this.store.touchSession(session.id, now, idleExpiresAt);
      session.lastSeenAt = now;
      session.idleExpiresAt = idleExpiresAt;
    }

    return session;
  }

  async logout(rawToken: string) {
    const session = await this.store.findSessionByTokenHash(
      hashSessionToken(rawToken),
    );

    if (session && !session.revokedAt) {
      await this.store.revokeSession(
        session.id,
        session.userId,
        this.now(),
      );
    }
  }
}
