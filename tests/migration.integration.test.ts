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

describe("phase 4 PostgreSQL migration", () => {
  it("adds revocable QR metadata without changing existing tables", async () => {
    const database = new PGlite();
    try {
      await database.exec(readMigration("20260728154000_init"));
      await database.exec(readMigration("20260728161000_phase_1_data_model"));
      await database.exec(readMigration("20260728174500_phase_2_auth_authorization"));
      await database.exec(readMigration("20260728183500_phase_3_menu_management"));
      await database.query(
        `INSERT INTO "Table" ("id", "number", "name", "sortOrder", "updatedAt")
         VALUES ('existing-table', 1, 'Masa 1', 1, CURRENT_TIMESTAMP)`,
      );
      await database.exec(
        readMigration("20260728193000_phase_4_table_qr_management"),
      );
      const tables = await database.query<{
        id: string;
        qrTokenVersion: number;
      }>(`SELECT "id", "qrTokenVersion" FROM "Table"`);
      expect(tables.rows).toEqual([
        { id: "existing-table", qrTokenVersion: 0 },
      ]);
      await database.query(
        `UPDATE "Table"
         SET "qrTokenHash" = 'unique-hash',
             "qrTokenEncrypted" = 'ciphertext',
             "qrTokenVersion" = 1,
             "qrRotatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = 'existing-table'`,
      );
      await database.query(
        `UPDATE "Table"
         SET "qrTokenHash" = 'rotated-hash', "qrTokenVersion" = 2
         WHERE "id" = 'existing-table'`,
      );
      const oldTokens = await database.query<{ count: string }>(
        `SELECT COUNT(*)::text AS "count" FROM "Table"
         WHERE "qrTokenHash" = 'unique-hash'`,
      );
      expect(oldTokens.rows).toEqual([{ count: "0" }]);
      await database.query(
        `INSERT INTO "Table" ("id", "number", "name", "sortOrder", "qrTokenHash", "updatedAt")
         VALUES ('second-table', 2, 'Masa 2', 2, 'second-hash', CURRENT_TIMESTAMP)`,
      );
      await expect(
        database.query(
          `UPDATE "Table" SET "qrTokenHash" = 'rotated-hash'
           WHERE "id" = 'second-table'`,
        ),
      ).rejects.toThrow(/Table_qrTokenHash_key/);
    } finally {
      await database.close();
    }
  });
});

describe("phase 5 PostgreSQL migration", () => {
  it("adds guest ordering and idempotency without losing table data", async () => {
    const database = new PGlite();
    try {
      for (const migration of [
        "20260728154000_init",
        "20260728161000_phase_1_data_model",
        "20260728174500_phase_2_auth_authorization",
        "20260728183500_phase_3_menu_management",
        "20260728193000_phase_4_table_qr_management",
      ]) {
        await database.exec(readMigration(migration));
      }
      await database.query(
        `INSERT INTO "Table" ("id", "number", "name", "sortOrder", "updatedAt")
         VALUES ('table-1', 1, 'Masa 1', 1, CURRENT_TIMESTAMP)`,
      );
      await database.exec(
        readMigration("20260728201500_phase_5_qr_order_flow"),
      );
      const tables = await database.query<{ name: string }>(
        `SELECT "name" FROM "Table" WHERE "id" = 'table-1'`,
      );
      expect(tables.rows).toEqual([{ name: "Masa 1" }]);
      await database.query(
        `INSERT INTO "GuestSession"
          ("id", "tableId", "tokenHash", "qrTokenVersion", "expiresAt")
         VALUES
          ('guest-1', 'table-1', 'guest-hash', 1, CURRENT_TIMESTAMP + INTERVAL '12 hours')`,
      );
      await expect(
        database.query(
          `INSERT INTO "GuestSession"
            ("id", "tableId", "tokenHash", "qrTokenVersion", "expiresAt")
           VALUES
            ('guest-2', 'table-1', 'guest-hash', 1, CURRENT_TIMESTAMP + INTERVAL '12 hours')`,
        ),
      ).rejects.toThrow(/GuestSession_tokenHash_key/);
      const columns = await database.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'Order'
           AND column_name IN ('guestSessionId', 'idempotencyKey', 'publicTokenHash', 'publicTokenEncrypted')`,
      );
      expect(columns.rows.map((row) => row.column_name)).toEqual(
        expect.arrayContaining([
          "guestSessionId",
          "idempotencyKey",
          "publicTokenHash",
          "publicTokenEncrypted",
        ]),
      );
      await database.query(
        `INSERT INTO "TableSession"
          ("id", "tableId", "businessDate", "updatedAt")
         VALUES ('session-1', 'table-1', DATE '2026-07-28', CURRENT_TIMESTAMP)`,
      );
      await database.query(
        `INSERT INTO "Order"
          ("id", "orderNumber", "tableSessionId", "tableId", "guestSessionId",
           "idempotencyKey", "publicTokenHash", "status", "source",
           "subtotal", "total", "updatedAt")
         VALUES
          ('order-1', 'QR-1', 'session-1', 'table-1', 'guest-1',
           'idem-1', 'public-hash-1', 'BEKLIYOR', 'QR',
           100.00, 100.00, CURRENT_TIMESTAMP)`,
      );
      await expect(
        database.query(
          `INSERT INTO "Order"
            ("id", "orderNumber", "tableSessionId", "tableId", "guestSessionId",
             "idempotencyKey", "publicTokenHash", "status", "source",
             "subtotal", "total", "updatedAt")
           VALUES
            ('order-2', 'QR-2', 'session-1', 'table-1', 'guest-1',
             'idem-1', 'public-hash-2', 'BEKLIYOR', 'QR',
             100.00, 100.00, CURRENT_TIMESTAMP)`,
        ),
      ).rejects.toThrow(/Order_idempotencyKey_key/);
      const orders = await database.query<{ count: string }>(
        `SELECT COUNT(*)::text AS "count" FROM "Order"
         WHERE "idempotencyKey" = 'idem-1'`,
      );
      expect(orders.rows).toEqual([{ count: "1" }]);
      try {
        await database.exec(
          `BEGIN;
           INSERT INTO "AuditLog" ("id", "action", "entityType")
           VALUES ('rolled-back-audit', 'GUEST_ORDER_CREATED', 'Order');
           INSERT INTO "OrderItem"
             ("id", "orderId", "productNameSnapshot", "unitPriceSnapshot",
              "quantity", "lineSubtotal", "prepStation", "updatedAt")
           VALUES
             ('invalid-item', 'missing-order', 'Ürün', 10.00, 1, 10.00,
              'MUTFAK', CURRENT_TIMESTAMP);
           COMMIT;`,
        );
      } catch {
        await database.exec("ROLLBACK");
      }
      const rolledBackAudit = await database.query<{ count: string }>(
        `SELECT COUNT(*)::text AS "count" FROM "AuditLog"
         WHERE "id" = 'rolled-back-audit'`,
      );
      expect(rolledBackAudit.rows).toEqual([{ count: "0" }]);
    } finally {
      await database.close();
    }
  });
});
