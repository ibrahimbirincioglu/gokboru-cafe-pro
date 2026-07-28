import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { buildInitialSettings, buildInitialTables } from "./seed-data";

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL tanımlı değil.");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    for (const table of buildInitialTables()) {
      await prisma.table.upsert({
        where: { number: table.number },
        update: {
          name: table.name,
          sortOrder: table.sortOrder,
          isActive: table.isActive,
        },
        create: table,
      });
    }

    for (const setting of buildInitialSettings()) {
      await prisma.appSetting.upsert({
        where: { key: setting.key },
        update: {},
        create: setting,
      });
    }

    console.info("20 başlangıç masası ve varsayılan ayarlar hazır.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Masa seed işlemi başarısız oldu.");
  throw error;
});
