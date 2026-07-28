import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import {
  buildDevelopmentUsers,
  buildInitialSettings,
  buildInitialTables,
} from "./seed-data";
import { createStoredQrToken } from "../src/features/qr/crypto";

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL tanımlı değil.");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });
  const qrSecret = process.env.QR_TOKEN_SECRET;

  if (!qrSecret || qrSecret.length < 32) {
    throw new Error("QR_TOKEN_SECRET en az 32 karakter olmalıdır.");
  }

  try {
    for (const table of buildInitialTables()) {
      const storedQr = createStoredQrToken(qrSecret);
      const savedTable = await prisma.table.upsert({
        where: { number: table.number },
        update: {},
        create: {
          ...table,
          qrTokenHash: storedQr.hash,
          qrTokenEncrypted: storedQr.encrypted,
          qrTokenVersion: 1,
          qrRotatedAt: new Date(),
        },
      });
      if (!savedTable.qrTokenHash || !savedTable.qrTokenEncrypted) {
        await prisma.table.update({
          where: { id: savedTable.id },
          data: {
            qrTokenHash: storedQr.hash,
            qrTokenEncrypted: storedQr.encrypted,
            qrTokenVersion: { increment: 1 },
            qrRotatedAt: new Date(),
          },
        });
      }
    }

    for (const setting of buildInitialSettings()) {
      await prisma.appSetting.upsert({
        where: { key: setting.key },
        update: {},
        create: setting,
      });
    }

    const developmentPasswordHash = process.env.DEV_SEED_PASSWORD_HASH;

    if (
      process.env.NODE_ENV !== "production" &&
      developmentPasswordHash
    ) {
      for (const user of buildDevelopmentUsers(
        developmentPasswordHash,
      )) {
        await prisma.user.upsert({
          where: { username: user.username },
          update: {},
          create: user,
        });
      }
    }

    console.info("Başlangıç masaları, ayarlar ve izin verilen geliştirme kullanıcıları hazır.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Masa seed işlemi başarısız oldu.");
  throw error;
});
