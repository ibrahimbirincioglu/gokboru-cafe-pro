import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { buildInitialTables } from "./seed-data";

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

    console.info("20 başlangıç masası hazır.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Masa seed işlemi başarısız oldu.");
  throw error;
});
