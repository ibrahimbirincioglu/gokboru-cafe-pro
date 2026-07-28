import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  TableSessionStatus,
  UserRole,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const schema = readFileSync(
  join(projectRoot, "prisma", "schema.prisma"),
  "utf8",
);
const migration = readFileSync(
  join(
    projectRoot,
    "prisma",
    "migrations",
    "20260728161000_phase_1_data_model",
    "migration.sql",
  ),
  "utf8",
);

describe("phase 1 data model", () => {
  it("contains all required user roles", () => {
    expect(Object.values(UserRole)).toEqual([
      "OWNER",
      "ADMIN",
      "CASHIER",
      "KITCHEN",
      "WAITER",
    ]);
  });

  it("contains the required lifecycle statuses", () => {
    expect(Object.values(TableSessionStatus)).toContain("PAYMENT_PROCESSING");
    expect(Object.values(OrderStatus)).toContain("TAMAMLANDI");
    expect(Object.values(PaymentStatus)).toContain("PARTIALLY_REFUNDED");
  });

  it("uses exact decimal arithmetic for money", () => {
    const total = new Prisma.Decimal("0.10").plus(
      new Prisma.Decimal("0.20"),
    );

    expect(total.equals(new Prisma.Decimal("0.30"))).toBe(true);
  });

  it("defines every money field as Decimal(12, 2)", () => {
    const moneyFields = [
      "price",
      "discountPrice",
      "subtotal",
      "discountTotal",
      "cancelledTotal",
      "total",
      "unitPriceSnapshot",
      "lineSubtotal",
      "amount",
      "refundedAmount",
    ];

    for (const field of moneyFields) {
      expect(schema).toMatch(
        new RegExp(
          `\\b${field}\\s+Decimal\\??\\s+(?:@default\\([^\\n]+\\)\\s+)?@db\\.Decimal\\(12, 2\\)`,
        ),
      );
    }
  });

  it("keeps product name and price snapshots on order items", () => {
    expect(schema).toContain("productNameSnapshot");
    expect(schema).toMatch(
      /unitPriceSnapshot\s+Decimal\s+@db\.Decimal\(12, 2\)/,
    );
  });

  it("makes payment idempotency keys unique", () => {
    expect(schema).toMatch(/idempotencyKey\s+String\s+@unique/);
  });
});

describe("phase 1 migration safety", () => {
  it("does not delete or truncate existing data", () => {
    expect(migration).not.toMatch(/^\s*(?:DROP|TRUNCATE|DELETE)\b/im);
  });

  it("preserves the existing Table and enforces one active session", () => {
    expect(migration).not.toContain('ALTER TABLE "Table"');
    expect(migration).toContain('"TableSession_one_active_per_table_key"');
    expect(migration).toContain(
      "WHERE \"status\" IN ('OPEN', 'PAYMENT_REQUESTED', 'PAYMENT_PROCESSING')",
    );
  });
});
