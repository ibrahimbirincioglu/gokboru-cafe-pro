export function buildInitialTables() {
  return Array.from({ length: 20 }, (_, index) => {
    const number = index + 1;

    return {
      number,
      name: `Masa ${number}`,
      sortOrder: number,
      isActive: true,
    };
  });
}

export function buildInitialSettings() {
  return [
    { key: "businessTimezone", valueJson: "Europe/Istanbul" },
    { key: "businessDayCutoff", valueJson: "00:00" },
    { key: "currency", valueJson: "TRY" },
    { key: "defaultLocale", valueJson: "tr-TR" },
    { key: "orderAutoAccept", valueJson: false },
    { key: "serviceChargeEnabled", valueJson: false },
  ];
}

export function buildDevelopmentUsers(passwordHash: string) {
  if (!passwordHash.startsWith("$argon2id$")) {
    throw new Error("DEV_SEED_PASSWORD_HASH geçerli bir Argon2id hash olmalıdır.");
  }

  return [
    {
      name: "Development Owner",
      username: "owner",
      role: UserRole.OWNER,
      passwordHash,
    },
    {
      name: "Development Admin",
      username: "admin",
      role: UserRole.ADMIN,
      passwordHash,
    },
    {
      name: "Development Cashier",
      username: "cashier",
      role: UserRole.CASHIER,
      passwordHash,
    },
    {
      name: "Development Waiter",
      username: "waiter",
      role: UserRole.WAITER,
      passwordHash,
    },
  ];
}
import { UserRole } from "@prisma/client";
