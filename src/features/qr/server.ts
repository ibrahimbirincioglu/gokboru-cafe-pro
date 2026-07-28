import "server-only";

import { createStoredQrToken, decryptQrToken, hashQrToken } from "./crypto";
import { publicQrTokenSchema } from "./validation";
import { getPrisma } from "@/lib/db/prisma";

export function getQrSecret() {
  const secret = process.env.QR_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("QR_TOKEN_SECRET en az 32 karakter olmalıdır.");
  }
  return secret;
}

export function newStoredQrToken() {
  return createStoredQrToken(getQrSecret());
}

export function qrPublicUrl(token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) throw new Error("NEXT_PUBLIC_APP_URL tanımlı değil.");
  return new URL(`/menu/t/${token}`, baseUrl).toString();
}

export function tokenFromEncrypted(payload: string) {
  return decryptQrToken(payload, getQrSecret());
}

export async function resolveActiveTableByQrToken(rawToken: string) {
  const token = publicQrTokenSchema.safeParse(rawToken);
  if (!token.success) return null;
  return getPrisma().table.findFirst({
    where: {
      qrTokenHash: hashQrToken(token.data),
      isActive: true,
    },
    select: {
      id: true,
      number: true,
      name: true,
      qrTokenVersion: true,
    },
  });
}
