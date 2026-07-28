import "server-only";

import { generateQrToken, hashQrToken } from "@/features/qr/crypto";
import { resolveActiveTableByQrToken } from "@/features/qr/server";
import { getPrisma } from "@/lib/db/prisma";
import { GUEST_SESSION_DURATION_MS } from "./config";
import { isGuestSessionValid } from "./validation";

export async function createGuestSession(qrToken: string) {
  const table = await resolveActiveTableByQrToken(qrToken);
  if (!table) return null;
  const rawToken = generateQrToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + GUEST_SESSION_DURATION_MS);
  const session = await getPrisma().guestSession.create({
    data: {
      tableId: table.id,
      tokenHash: hashQrToken(rawToken),
      qrTokenVersion: table.qrTokenVersion,
      expiresAt,
    },
  });
  return { rawToken, expiresAt, session, table };
}

export async function validateGuestSession(
  rawToken: string | undefined,
  qrToken: string,
) {
  if (!rawToken) return null;
  const table = await resolveActiveTableByQrToken(qrToken);
  if (!table) return null;
  const now = new Date();
  const session = await getPrisma().guestSession.findUnique({
    where: { tokenHash: hashQrToken(rawToken) },
  });
  if (!session || !isGuestSessionValid(session, table, now)) {
    return null;
  }
  await getPrisma().guestSession.update({
    where: { id: session.id },
    data: { lastSeenAt: now },
  });
  return { session, table };
}
