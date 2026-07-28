import { UserRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
} from "../src/lib/auth/password";
import {
  createSessionToken,
  hashSensitiveIdentifier,
  hashSessionToken,
} from "../src/lib/auth/tokens";
import { safeReturnPath } from "../src/lib/auth/validation";

describe("password security", () => {
  it("hashes with Argon2id and verifies without storing plaintext", async () => {
    const password = "Guvenli-Test-Parolasi-2026!";
    const passwordHash = await hashPassword(password);

    expect(passwordHash).toMatch(/^\$argon2id\$/);
    expect(passwordHash).not.toContain(password);
    await expect(verifyPassword(passwordHash, password)).resolves.toBe(
      true,
    );
    await expect(
      verifyPassword(passwordHash, "yanlis-parola"),
    ).resolves.toBe(false);
  });
});

describe("opaque session tokens", () => {
  it("creates random tokens and stores only deterministic hashes", () => {
    const first = createSessionToken();
    const second = createSessionToken();

    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).toBe(hashSessionToken(first.token));
    expect(first.tokenHash).not.toContain(first.token);
    expect(first.tokenHash).toHaveLength(64);
  });

  it("HMAC-hashes login identifiers", () => {
    const secret = "a".repeat(32);

    expect(hashSensitiveIdentifier("Admin", secret)).toBe(
      hashSensitiveIdentifier("admin", secret),
    );
    expect(hashSensitiveIdentifier("admin", secret)).toHaveLength(64);
  });
});

describe("safe redirects", () => {
  it("accepts local paths and rejects external redirects", () => {
    expect(safeReturnPath("/admin")).toBe("/admin");
    expect(safeReturnPath("//evil.example")).toBeNull();
    expect(safeReturnPath("https://evil.example")).toBeNull();
    expect(safeReturnPath(null)).toBeNull();
  });

  it("keeps the UserRole import exercised by the auth bundle", () => {
    expect(UserRole.OWNER).toBe("OWNER");
  });
});
