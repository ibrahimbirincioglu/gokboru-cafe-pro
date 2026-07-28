import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma, UserRole } from "@prisma/client";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { calculateSessionTotals } from "../src/features/pos/money";
import { hasPermission, PERMISSIONS } from "../src/lib/auth/permissions";

const migrations = [
  "20260728154000_init",
  "20260728161000_phase_1_data_model",
  "20260728174500_phase_2_auth_authorization",
  "20260728183500_phase_3_menu_management",
  "20260728193000_phase_4_table_qr_management",
  "20260728201500_phase_5_qr_order_flow",
  "20260728210000_phase_7_pos_payments",
];

async function openDatabase() {
  const database = new PGlite();
  for (const migration of migrations) {
    await database.exec(readFileSync(join(process.cwd(), "prisma", "migrations", migration, "migration.sql"), "utf8"));
  }
  await database.exec(`
    INSERT INTO "Table" ("id","number","name","sortOrder","updatedAt") VALUES ('table-1',1,'Masa 1',1,CURRENT_TIMESTAMP);
    INSERT INTO "User" ("id","name","username","passwordHash","role","updatedAt") VALUES ('cashier-1','Kasiyer','cashier','hash','CASHIER',CURRENT_TIMESTAMP);
    INSERT INTO "TableSession" ("id","tableId","businessDate","updatedAt") VALUES ('session-1','table-1',DATE '2026-07-28',CURRENT_TIMESTAMP);
    INSERT INTO "Order" ("id","orderNumber","tableSessionId","tableId","status","source","subtotal","total","updatedAt")
      VALUES ('order-1','ORDER-1','session-1','table-1','HAZIR','QR',100,100,CURRENT_TIMESTAMP);
    INSERT INTO "OrderItem" ("id","orderId","productNameSnapshot","unitPriceSnapshot","quantity","lineSubtotal","prepStation","updatedAt")
      VALUES ('item-1','order-1','Kahve',100,1,100,'BAR',CURRENT_TIMESTAMP);
  `);
  return database;
}

describe("Phase 7 money and authorization", () => {
  it("recalculates payable amount with Decimal snapshots", () => {
    const totals = calculateSessionTotals(
      [{ unitPriceSnapshot: new Prisma.Decimal("12.35"), quantity: 3, cancelledQuantity: 1 }],
      new Prisma.Decimal("4.70"),
    );
    expect(totals.subtotal.toFixed(2)).toBe("24.70");
    expect(totals.amount.toFixed(2)).toBe("20.00");
  });

  it("lets cashier take payment but only authority adjust orders", () => {
    expect(hasPermission(UserRole.CASHIER, PERMISSIONS.PAYMENTS_TAKE)).toBe(true);
    expect(hasPermission(UserRole.CASHIER, PERMISSIONS.ORDERS_ADJUST)).toBe(false);
    expect(hasPermission(UserRole.ADMIN, PERMISSIONS.ORDERS_ADJUST)).toBe(true);
  });
});

describe("Phase 7 PostgreSQL transaction safety", () => {
  it("allows only one completed payment when requests race", async () => {
    const database = await openDatabase();
    try {
      const insert = (id: string) => database.query(`
        INSERT INTO "Payment" ("id","paymentNumber","tableSessionId","amount","subtotal","paymentType","status","idempotencyKey","receivedByUserId","businessDate","paidAt","updatedAt")
        VALUES ('${id}','${id}','session-1',100,100,'NAKIT','COMPLETED','${id}','cashier-1',DATE '2026-07-28',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      `);
      const results = await Promise.allSettled([insert("pay-1"), insert("pay-2")]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const count = await database.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM "Payment"`);
      expect(count.rows[0]?.count).toBe("1");
    } finally {
      await database.close();
    }
  });

  it("rolls payment, orders, table close and audit back together", async () => {
    const database = await openDatabase();
    try {
      try {
        await database.exec(`
          BEGIN;
          INSERT INTO "Payment" ("id","paymentNumber","tableSessionId","amount","subtotal","paymentType","status","idempotencyKey","receivedByUserId","businessDate","paidAt","updatedAt")
            VALUES ('rollback-pay','ROLLBACK','session-1',100,100,'NAKIT','COMPLETED','rollback-key','cashier-1',DATE '2026-07-28',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
          UPDATE "Order" SET "status"='TAMAMLANDI',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"='order-1';
          UPDATE "TableSession" SET "status"='CLOSED',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"='session-1';
          INSERT INTO "AuditLog" ("id","actorUserId","action","entityType","entityId")
            VALUES ('rollback-audit','cashier-1','PAYMENT_COMPLETED_AND_TABLE_CLOSED','Payment','rollback-pay');
          INSERT INTO "Payment" ("id","paymentNumber","tableSessionId","amount","subtotal","paymentType","status","idempotencyKey","receivedByUserId","businessDate","updatedAt")
            VALUES ('invalid','INVALID','missing-session',1,1,'NAKIT','FAILED','invalid','cashier-1',DATE '2026-07-28',CURRENT_TIMESTAMP);
          COMMIT;
        `);
      } catch {
        await database.exec("ROLLBACK");
      }
      const result = await database.query<{ order_status: string; session_status: string; payment_count: string; audit_count: string }>(`
        SELECT
          (SELECT "status"::text FROM "Order" WHERE "id"='order-1') AS order_status,
          (SELECT "status"::text FROM "TableSession" WHERE "id"='session-1') AS session_status,
          (SELECT COUNT(*)::text FROM "Payment") AS payment_count,
          (SELECT COUNT(*)::text FROM "AuditLog") AS audit_count
      `);
      expect(result.rows[0]).toEqual({ order_status: "HAZIR", session_status: "OPEN", payment_count: "0", audit_count: "0" });
    } finally {
      await database.close();
    }
  });
});
