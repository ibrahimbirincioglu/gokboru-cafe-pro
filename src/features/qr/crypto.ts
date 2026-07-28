import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const TOKEN_BYTES = 32;
const IV_BYTES = 12;

function encryptionKey(secret: string) {
  if (secret.length < 32) {
    throw new Error("QR_TOKEN_SECRET en az 32 karakter olmalıdır.");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

export function generateQrToken() {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashQrToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function encryptQrToken(token: string, secret: string) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

export function decryptQrToken(payload: string, secret: string) {
  const packed = Buffer.from(payload, "base64url");
  if (packed.length <= IV_BYTES + 16) {
    throw new Error("Geçersiz QR token kaydı.");
  }
  const iv = packed.subarray(0, IV_BYTES);
  const tag = packed.subarray(IV_BYTES, IV_BYTES + 16);
  const ciphertext = packed.subarray(IV_BYTES + 16);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(secret),
    iv,
  );
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export function createStoredQrToken(secret: string) {
  const token = generateQrToken();
  return {
    token,
    hash: hashQrToken(token),
    encrypted: encryptQrToken(token, secret),
  };
}
