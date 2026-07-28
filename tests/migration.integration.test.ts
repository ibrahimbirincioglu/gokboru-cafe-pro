import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

function readMigration(directory: string) {
  return readFileSync(
    join(
      projectRoot,
      "prisma",
      "migrations",
      directory,
      "migration.sql",
    ),
    "utf8",
  );
}

describe("phase 1 PostgreSQL migration", () => {
  it("applies after the initial migration without losing existing tables", async () => {
    const database = new PGlite();

    try {
      await database.exec(readMigration("20260728154000_init"));
      await database.query(
        `INSERT INTO "Table"
          ("id", "number", "name", "sortOrder", "updatedAt")
         VALUES
          ('existing-table', 1, 'Masa 1', 1, CURRENT_TIMESTAMP)`,
      );

      await database.exec(
        readMigration("20260728161000_phase_1_data_model"),
      );

      const existingTables = await database.query<{
        id: string;
        number: number;
      }>(`SELECT "id", "number" FROM "Table"`);

      expect(existingTables.rows).toEqual([
        { id: "existing-table", number: 1 },
      ]);

      const createdModels = await database.query<{ table_name: string }>(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public'`,
      );

      expect(createdModels.rows.map((row) => row.table_name)).toEqual(
        expect.arrayContaining([
          "User",
          "Category",
          "Product",
          "TableSession",
          "Order",
          "OrderItem",
          "OrderStatusHistory",
          "Payment",
          "ServiceRequest",
          "AuditLog",
          "AppSetting",
        ]),
      );

      await database.query(
        `INSERT INTO "TableSession"
          ("id", "tableId", "businessDate", "updatedAt")
         VALUES
          ('open-session-1', 'existing-table', DATE '2026-07-28', CURRENT_TIMESTAMP)`,
      );

      await expect(
        database.query(
          `INSERT INTO "TableSession"
            ("id", "tableId", "businessDate", "updatedAt")
           VALUES
            ('open-session-2', 'existing-table', DATE '2026-07-28', CURRENT_TIMESTAMP)`,
        ),
      ).rejects.toThrow(/TableSession_one_active_per_table_key/);

      await database.query(
        `INSERT INTO "AuditLog"
          ("id", "action", "entityType")
         VALUES
          ('audit-1', 'MIGRATION_TEST', 'Table')`,
      );

      await expect(
        database.query(
          `UPDATE "AuditLog"
           SET "action" = 'TAMPERED'
           WHERE "id" = 'audit-1'`,
        ),
      ).rejects.toThrow(/append-only/);

      await expect(
        database.query(`DELETE FROM "AuditLog" WHERE "id" = 'audit-1'`),
      ).rejects.toThrow(/append-only/);
    } finally {
      await database.close();
    }
  });
});
