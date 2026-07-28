import { createHash, createHmac, randomBytes } from "node:crypto";

export function createSessionToken() {
  const token = randomBytes(32).toString("base64url");

  return {
    token,
    tokenHash: hashSessionToken(token),
  };
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashSensitiveIdentifier(value: string, secret: string) {
  return createHmac("sha256", secret)
    .update(value.trim().toLocaleLowerCase("tr-TR"))
    .digest("hex");
}
