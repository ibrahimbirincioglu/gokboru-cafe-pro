import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { UserRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { csvCell, csvRow } from "../src/features/reports/csv";
import { hasPermission, PERMISSIONS } from "../src/lib/auth/permissions";
import {
  addDays,
  istanbulDate,
  istanbulUtcRange,
  reportRange,
} from "../src/features/reports/dates";

const migrations = [
  "20260728154000_init",
  "20260728161000_phase_1_data_model",
  "20260728174500_phase_2_auth_authorization",
  "20260728183500_phase_3_menu_management",
  "20260728193000_phase_4_table_qr_management",
  "20260728201500_phase_5_qr_order_flow",
  "20260728210000_phase_7_pos_payments",
  "20260728220000_phase_8_report_indexes",
];

describe("Europe/Istanbul report dates", () => {
  it("starts a new business day at Istanbul midnight without deleting history", () => {
    expect(istanbulDate(new Date("2026-07-28T20:59:59Z"))).toBe("2026-07-28");
    expect(istanbulDate(new Date("2026-07-28T21:00:00Z"))).toBe("2026-07-29");
    expect(istanbulUtcRange("2026-07-27", "2026-07-27")).toEqual({
      gte: new Date("2026-07-26T21:00:00Z"),
      lt: new Date("2026-07-27T21:00:00Z"),
    });
  });

  it("builds daily, weekly, monthly and bounded custom ranges", () => {
    const now = new Date("2026-07-28T12:00:00Z");
    expect(reportRange("day", undefined, undefined, now)).toMatchObject({
      from: "2026-07-28", to: "2026-07-28",
    });
    expect(reportRange("week", undefined, undefined, now)).toMatchObject({
      from: "2026-07-27", to: "2026-07-28",
    });
    expect(reportRange("month", undefined, undefined, now)).toMatchObject({
      from: "2026-07-01", to: "2026-07-28",
    });
    expect(reportRange("custom", "2026-07-01", "2026-07-28", now)).toMatchObject({
      from: "2026-07-01", to: "2026-07-28",
    });
    expect(() => reportRange("custom", "2025-01-01", "2026-07-28", now)).toThrow();
    expect(addDays("2026-07-28", -2)).toBe("2026-07-26");
  });
});

describe("CSV safety", () => {
  it("quotes delimiters and neutralizes spreadsheet formulas", () => {
    expect(csvCell('Çay, "demli"')).toBe('"Çay, ""demli"""');
    expect(csvCell("=HYPERLINK(\"bad\")")).toBe('"\'=HYPERLINK(""bad"")"');
    expect(csvRow(["Masa 1", "NAKIT"])).toBe('"Masa 1","NAKIT"');
  });
});

describe("report authorization", () => {
  it("allows OWNER/ADMIN and denies cashier, waiter and kitchen", () => {
    expect(hasPermission(UserRole.OWNER, PERMISSIONS.REPORTS_VIEW)).toBe(true);
    expect(hasPermission(UserRole.ADMIN, PERMISSIONS.REPORTS_VIEW)).toBe(true);
    expect(hasPermission(UserRole.CASHIER, PERMISSIONS.REPORTS_VIEW)).toBe(false);
    expect(hasPermission(UserRole.WAITER, PERMISSIONS.REPORTS_VIEW)).toBe(false);
    expect(hasPermission(UserRole.KITCHEN, PERMISSIONS.REPORTS_VIEW)).toBe(false);
  });
});

describe("Phase 8 indexes and historical lookup", () => {
  it("applies additively, finds a two-day-old order, and uses report indexes", async () => {
    const database = new PGlite();
    try {
      for (const migration of migrations) {
        await database.exec(
          readFileSync(join(process.cwd(), "prisma", "migrations", migration, "migration.sql"), "utf8"),
        );
      }
      await database.exec(`
        INSERT INTO "Table" ("id","number","name","sortOrder","updatedAt")
          VALUES ('table-1',1,'Masa 1',1,CURRENT_TIMESTAMP);
        INSERT INTO "TableSession" ("id","tableId","businessDate","status","updatedAt")
          VALUES ('session-1','table-1',DATE '2026-07-26','CLOSED',CURRENT_TIMESTAMP);
        INSERT INTO "Order" ("id","orderNumber","tableSessionId","tableId","status","source","subtotal","total","createdAt","updatedAt")
          VALUES ('old-order','OLD-1','session-1','table-1','TAMAMLANDI','QR',50,50,TIMESTAMPTZ '2026-07-25 22:30:00Z',CURRENT_TIMESTAMP);
        INSERT INTO "OrderItem" ("id","orderId","productNameSnapshot","unitPriceSnapshot","quantity","lineSubtotal","prepStation","updatedAt")
          VALUES ('old-item','old-order','İki Günlük Çay',50,1,50,'BAR',CURRENT_TIMESTAMP);
        INSERT INTO "Payment" ("id","paymentNumber","tableSessionId","amount","subtotal","paymentType","status","idempotencyKey","receivedByUserId","businessDate","updatedAt")
          SELECT 'payment-1','PAY-1','session-1',50,50,'NAKIT','COMPLETED','idem-1',"id",DATE '2026-07-26',CURRENT_TIMESTAMP
          FROM "User" LIMIT 0;
      `);
      const oldOrder = await database.query<{ id: string; product: string }>(`
        SELECT o."id", oi."productNameSnapshot" AS product
        FROM "Order" o JOIN "OrderItem" oi ON oi."orderId"=o."id"
        WHERE o."createdAt" >= TIMESTAMPTZ '2026-07-25 21:00:00Z'
          AND o."createdAt" < TIMESTAMPTZ '2026-07-26 21:00:00Z'
          AND o."tableId"='table-1' AND o."status"='TAMAMLANDI'
      `);
      expect(oldOrder.rows).toEqual([{ id: "old-order", product: "İki Günlük Çay" }]);

      const indexes = await database.query<{ indexname: string }>(`
        SELECT indexname FROM pg_indexes WHERE indexname IN (
          'Payment_businessDate_status_paymentType_idx',
          'Order_createdAt_status_tableId_createdByUserId_idx',
          'OrderItem_productId_orderId_idx'
        )
      `);
      expect(indexes.rows).toHaveLength(3);
      await database.exec("SET enable_seqscan=off");
      const plan = await database.query<Record<string, string>>(`
        EXPLAIN SELECT * FROM "Order"
        WHERE "createdAt" >= TIMESTAMPTZ '2026-07-25 21:00:00Z'
          AND "createdAt" < TIMESTAMPTZ '2026-07-26 21:00:00Z'
          AND "status"='TAMAMLANDI' AND "tableId"='table-1'
      `);
      expect(JSON.stringify(plan.rows)).toContain("Order_createdAt_status_tableId_createdByUserId_idx");
    } finally {
      await database.close();
    }
  });
});
