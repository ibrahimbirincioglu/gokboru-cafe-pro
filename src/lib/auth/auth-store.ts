import "server-only";

import { randomUUID } from "node:crypto";
import {
  Prisma,
  type PrismaClient,
  type UserRole,
} from "@prisma/client";
import { AUTH_CONFIG } from "./config";

export type AuthUser = {
  id: string;
  name: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
};

export type ActiveSession = {
  id: string;
  userId: string;
  expiresAt: Date;
  idleExpiresAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
  user: Omit<AuthUser, "passwordHash" | "username">;
};

export type LoginAttemptReservation = {
  failureCount: number;
  blockedUntil: Date | null;
};

export interface AuthStore {
  reserveLoginAttempt(input: {
    identifierHash: string;
    ipHash: string;
    now: Date;
  }): Promise<LoginAttemptReservation>;
  clearLoginAttempts(identifierHash: string, ipHash: string): Promise<void>;
  findUserByUsername(username: string): Promise<AuthUser | null>;
  recordFailedLogin(userId: string | null, rateLimited: boolean): Promise<void>;
  completeLogin(input: {
    user: AuthUser;
    tokenHash: string;
    ipHash: string;
    userAgentHash: string;
    expiresAt: Date;
    idleExpiresAt: Date;
    now: Date;
  }): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<ActiveSession | null>;
  touchSession(
    sessionId: string,
    lastSeenAt: Date,
    idleExpiresAt: Date,
  ): Promise<void>;
  revokeSession(
    sessionId: string,
    userId: string,
    now: Date,
  ): Promise<void>;
}

export class PrismaAuthStore implements AuthStore {
  constructor(private readonly prisma: PrismaClient) {}

  async reserveLoginAttempt({
    identifierHash,
    ipHash,
    now,
  }: {
    identifierHash: string;
    ipHash: string;
    now: Date;
  }) {
    const id = randomUUID();
    const windowStart = new Date(now.getTime() - AUTH_CONFIG.loginWindowMs);
    const blockedUntil = new Date(
      now.getTime() + AUTH_CONFIG.loginBlockDurationMs,
    );

    const [reservation] = await this.prisma.$queryRaw<
      LoginAttemptReservation[]
    >(Prisma.sql`
      INSERT INTO "LoginAttempt"
        ("id", "identifierHash", "ipHash", "failureCount", "windowStartedAt", "updatedAt")
      VALUES
        (${id}, ${identifierHash}, ${ipHash}, 1, ${now}, ${now})
      ON CONFLICT ("identifierHash", "ipHash")
      DO UPDATE SET
        "failureCount" = CASE
          WHEN "LoginAttempt"."windowStartedAt" < ${windowStart} THEN 1
          ELSE "LoginAttempt"."failureCount" + 1
        END,
        "windowStartedAt" = CASE
          WHEN "LoginAttempt"."windowStartedAt" < ${windowStart} THEN ${now}
          ELSE "LoginAttempt"."windowStartedAt"
        END,
        "blockedUntil" = CASE
          WHEN "LoginAttempt"."blockedUntil" > ${now}
            THEN "LoginAttempt"."blockedUntil"
          WHEN (
            CASE
              WHEN "LoginAttempt"."windowStartedAt" < ${windowStart} THEN 1
              ELSE "LoginAttempt"."failureCount" + 1
            END
          ) >= ${AUTH_CONFIG.loginMaxAttempts}
            THEN ${blockedUntil}
          ELSE NULL
        END,
        "updatedAt" = ${now}
      RETURNING
        "failureCount",
        "blockedUntil"
    `);

    if (!reservation) {
      throw new Error("Giriş deneme kaydı oluşturulamadı.");
    }

    return reservation;
  }

  async clearLoginAttempts(identifierHash: string, ipHash: string) {
    await this.prisma.loginAttempt.deleteMany({
      where: { identifierHash, ipHash },
    });
  }

  findUserByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        name: true,
        username: true,
        passwordHash: true,
        role: true,
        isActive: true,
      },
    });
  }

  async recordFailedLogin(userId: string | null, rateLimited: boolean) {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: "AUTH_LOGIN_FAILED",
        entityType: "User",
        entityId: userId,
        safeMetadata: { rateLimited },
      },
    });
  }

  async completeLogin({
    user,
    tokenHash,
    ipHash,
    userAgentHash,
    expiresAt,
    idleExpiresAt,
    now,
  }: {
    user: AuthUser;
    tokenHash: string;
    ipHash: string;
    userAgentHash: string;
    expiresAt: Date;
    idleExpiresAt: Date;
    now: Date;
  }) {
    await this.prisma.$transaction([
      this.prisma.userSession.create({
        data: {
          userId: user.id,
          tokenHash,
          ipHash,
          userAgentHash,
          expiresAt,
          idleExpiresAt,
          lastSeenAt: now,
        },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: now },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "AUTH_LOGIN_SUCCEEDED",
          entityType: "User",
          entityId: user.id,
        },
      }),
    ]);
  }

  findSessionByTokenHash(tokenHash: string) {
    return this.prisma.userSession.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        idleExpiresAt: true,
        lastSeenAt: true,
        revokedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            isActive: true,
          },
        },
      },
    });
  }

  async touchSession(
    sessionId: string,
    lastSeenAt: Date,
    idleExpiresAt: Date,
  ) {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { lastSeenAt, idleExpiresAt },
    });
  }

  async revokeSession(sessionId: string, userId: string, now: Date) {
    await this.prisma.$transaction([
      this.prisma.userSession.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: userId,
          action: "AUTH_SESSION_REVOKED",
          entityType: "UserSession",
          entityId: sessionId,
        },
      }),
    ]);
  }
}
