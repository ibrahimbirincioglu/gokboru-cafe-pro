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

describe("phase 2 PostgreSQL migration", () => {
  it("adds persistent sessions and login throttling without data loss", async () => {
    const database = new PGlite();

    try {
      await database.exec(readMigration("20260728154000_init"));
      await database.exec(
        readMigration("20260728161000_phase_1_data_model"),
      );
      await database.query(
        `INSERT INTO "User"
          ("id", "name", "username", "passwordHash", "role", "updatedAt")
         VALUES
          ('existing-user', 'Mevcut Admin', 'admin', 'hash', 'ADMIN', CURRENT_TIMESTAMP)`,
      );

      await database.exec(
        readMigration("20260728174500_phase_2_auth_authorization"),
      );

      const users = await database.query<{ id: string }>(
        `SELECT "id" FROM "User"`,
      );
      expect(users.rows).toEqual([{ id: "existing-user" }]);

      await database.query(
        `INSERT INTO "UserSession"
          ("id", "userId", "tokenHash", "expiresAt", "idleExpiresAt")
         VALUES
          ('session-1', 'existing-user', 'token-hash', CURRENT_TIMESTAMP + INTERVAL '8 hours', CURRENT_TIMESTAMP + INTERVAL '30 minutes')`,
      );

      await expect(
        database.query(
          `INSERT INTO "UserSession"
            ("id", "userId", "tokenHash", "expiresAt", "idleExpiresAt")
           VALUES
            ('session-2', 'existing-user', 'token-hash', CURRENT_TIMESTAMP + INTERVAL '8 hours', CURRENT_TIMESTAMP + INTERVAL '30 minutes')`,
        ),
      ).rejects.toThrow(/UserSession_tokenHash_key/);

      const authTables = await database.query<{ table_name: string }>(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name IN ('UserSession', 'LoginAttempt')`,
      );
      expect(authTables.rows.map((row) => row.table_name).sort()).toEqual([
        "LoginAttempt",
        "UserSession",
      ]);
    } finally {
      await database.close();
    }
  });
});

describe("phase 3 PostgreSQL migration", () => {
  it("adds product options without changing existing catalog data", async () => {
    const database = new PGlite();

    try {
      await database.exec(readMigration("20260728154000_init"));
      await database.exec(
        readMigration("20260728161000_phase_1_data_model"),
      );
      await database.exec(
        readMigration("20260728174500_phase_2_auth_authorization"),
      );
      await database.query(
        `INSERT INTO "Category"
          ("id", "name", "slug", "updatedAt")
         VALUES
          ('category-1', 'Burger', 'burger', CURRENT_TIMESTAMP)`,
      );
      await database.query(
        `INSERT INTO "Product"
          ("id", "categoryId", "name", "slug", "price", "prepStation", "updatedAt")
         VALUES
          ('product-1', 'category-1', 'Gökbörü Burger', 'gokboru-burger', 250.90, 'MUTFAK', CURRENT_TIMESTAMP)`,
      );

      await database.exec(
        readMigration("20260728183500_phase_3_menu_management"),
      );

      const products = await database.query<{
        id: string;
        price: string;
      }>(`SELECT "id", "price"::text AS "price" FROM "Product"`);
      expect(products.rows).toEqual([
        { id: "product-1", price: "250.90" },
      ]);

      await database.query(
        `INSERT INTO "ProductOptionGroup"
          ("id", "productId", "name", "minSelect", "maxSelect", "updatedAt")
         VALUES
          ('group-1', 'product-1', 'Ekstralar', 0, 2, CURRENT_TIMESTAMP)`,
      );
      await database.query(
        `INSERT INTO "ProductOption"
          ("id", "groupId", "name", "priceDelta", "updatedAt")
         VALUES
          ('option-1', 'group-1', 'Ekstra peynir', 25.50, CURRENT_TIMESTAMP)`,
      );

      const options = await database.query<{
        name: string;
        priceDelta: string;
      }>(
        `SELECT "name", "priceDelta"::text AS "priceDelta"
         FROM "ProductOption"`,
      );
      expect(options.rows).toEqual([
        { name: "Ekstra peynir", priceDelta: "25.50" },
      ]);

      await expect(
        database.query(
          `INSERT INTO "ProductOptionGroup"
            ("id", "productId", "name", "minSelect", "maxSelect", "updatedAt")
           VALUES
            ('invalid-group', 'product-1', 'Geçersiz', 3, 1, CURRENT_TIMESTAMP)`,
        ),
      ).rejects.toThrow(/ProductOptionGroup_selection_check/);
    } finally {
      await database.close();
    }
  });
});
