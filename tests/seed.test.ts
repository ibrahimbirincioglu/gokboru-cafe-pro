import { describe, expect, it } from "vitest";
import { buildInitialTables } from "../prisma/seed-data";

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
