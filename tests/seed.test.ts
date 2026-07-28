import { describe, expect, it } from "vitest";
import {
  buildDevelopmentUsers,
  buildInitialSettings,
  buildInitialTables,
} from "../prisma/seed-data";

describe("buildInitialTables", () => {
  it("creates 20 ordered, active and uniquely numbered tables", () => {
    const tables = buildInitialTables();

    expect(tables).toHaveLength(20);
    expect(tables[0]).toEqual({
      number: 1,
      name: "Masa 1",
      sortOrder: 1,
      isActive: true,
    });
    expect(tables[19]).toEqual({
      number: 20,
      name: "Masa 20",
      sortOrder: 20,
      isActive: true,
    });
    expect(new Set(tables.map((table) => table.number)).size).toBe(20);
  });
});

describe("buildDevelopmentUsers", () => {
  it("creates only the four login-enabled roles from an Argon2id hash", () => {
    const passwordHash =
      "$argon2id$v=19$m=65536,t=3,p=1$c2FsdA$ZmFrZS1oYXNo";
    const users = buildDevelopmentUsers(passwordHash);

    expect(users.map((user) => user.username)).toEqual([
      "owner",
      "admin",
      "cashier",
      "waiter",
    ]);
    expect(users.every((user) => user.passwordHash === passwordHash)).toBe(
      true,
    );
  });

  it("rejects plaintext development passwords", () => {
    expect(() => buildDevelopmentUsers("plaintext-password")).toThrow(
      /Argon2id/,
    );
  });
});

describe("buildInitialSettings", () => {
  it("uses the required Istanbul timezone and Turkish Lira defaults", () => {
    const settings = Object.fromEntries(
      buildInitialSettings().map((setting) => [
        setting.key,
        setting.valueJson,
      ]),
    );

    expect(settings.businessTimezone).toBe("Europe/Istanbul");
    expect(settings.businessDayCutoff).toBe("00:00");
    expect(settings.currency).toBe("TRY");
  });
});
