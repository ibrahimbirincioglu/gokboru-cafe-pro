import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { isGuestSessionValid } from "../src/features/guest-session/validation";
import {
  OrderPricingError,
  priceOrder,
  type CatalogProduct,
} from "../src/features/orders/pricing";
import { businessDateForIstanbul } from "../src/features/orders/time";
import { createOrderInputSchema } from "../src/features/orders/validation";
import { generateQrToken } from "../src/features/qr/crypto";

function product(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: "product-1",
    name: "Burger",
    price: new Prisma.Decimal("250.90"),
    discountPrice: new Prisma.Decimal("225.50"),
    prepStation: "MUTFAK",
    allowNote: true,
    isActive: true,
    isAvailable: true,
    categoryActive: true,
    optionGroups: [
      {
        id: "group-1",
        minSelect: 1,
        maxSelect: 2,
        required: true,
        isActive: true,
        options: [
          {
            id: "option-1",
            name: "Peynir",
            priceDelta: new Prisma.Decimal("25.25"),
            isActive: true,
          },
          {
            id: "option-2",
            name: "Acı sos",
            priceDelta: new Prisma.Decimal("0.00"),
            isActive: true,
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("server-side order pricing", () => {
  it("recalculates discount, options and quantity with Decimal snapshots", () => {
    const result = priceOrder(
      {
        items: [
          {
            productId: "product-1",
            quantity: 2,
            note: "Soğansız",
            optionIds: ["option-1"],
          },
        ],
      },
      [product()],
    );
    expect(result.items[0]?.unitPriceSnapshot.toFixed(2)).toBe("250.75");
    expect(result.items[0]?.lineSubtotal.toFixed(2)).toBe("501.50");
    expect(result.subtotal.toFixed(2)).toBe("552.30");
    expect(result.discountTotal.toFixed(2)).toBe("50.80");
    expect(result.total.toFixed(2)).toBe("501.50");
    expect(result.items[0]?.productNameSnapshot).toBe("Burger");
  });

  it("rejects inactive products and invalid option selections", () => {
    expect(() =>
      priceOrder(
        { items: [{ productId: "product-1", quantity: 1, note: "", optionIds: [] }] },
        [product()],
      ),
    ).toThrow(OrderPricingError);
    expect(() =>
      priceOrder(
        {
          items: [{
            productId: "product-1",
            quantity: 1,
            note: "",
            optionIds: ["option-1"],
          }],
        },
        [product({ isAvailable: false })],
      ),
    ).toThrow(OrderPricingError);
  });

  it("rejects duplicate or cross-product option identifiers", () => {
    for (const optionIds of [
      ["option-1", "option-1"],
      ["option-from-another-product"],
    ]) {
      expect(() =>
        priceOrder(
          { items: [{ productId: "product-1", quantity: 1, note: "", optionIds }] },
          [product()],
        ),
      ).toThrow(OrderPricingError);
    }
  });
});

describe("guest order security", () => {
  it("binds a guest session to table, QR version and expiry", () => {
    const now = new Date("2026-07-28T18:00:00Z");
    const session = {
      tableId: "table-1",
      qrTokenVersion: 3,
      expiresAt: new Date("2026-07-28T19:00:00Z"),
    };
    expect(
      isGuestSessionValid(session, { id: "table-1", qrTokenVersion: 3 }, now),
    ).toBe(true);
    expect(
      isGuestSessionValid(session, { id: "table-2", qrTokenVersion: 3 }, now),
    ).toBe(false);
    expect(
      isGuestSessionValid(session, { id: "table-1", qrTokenVersion: 4 }, now),
    ).toBe(false);
    expect(
      isGuestSessionValid(
        { ...session, expiresAt: now },
        { id: "table-1", qrTokenVersion: 3 },
        now,
      ),
    ).toBe(false);
  });

  it("validates bounded cart input and UUID idempotency", () => {
    const valid = {
      qrToken: generateQrToken(),
      idempotencyKey: crypto.randomUUID(),
      items: [
        { productId: "product-1", quantity: 1, note: "", optionIds: [] },
      ],
    };
    expect(createOrderInputSchema.safeParse(valid).success).toBe(true);
    expect(
      createOrderInputSchema.safeParse({
        ...valid,
        idempotencyKey: "predictable",
      }).success,
    ).toBe(false);
    expect(
      createOrderInputSchema.safeParse({
        ...valid,
        items: [{ ...valid.items[0], quantity: 21 }],
      }).success,
    ).toBe(false);
  });
});

describe("Istanbul business date", () => {
  it("uses the Istanbul calendar date across UTC midnight", () => {
    expect(
      businessDateForIstanbul(new Date("2026-07-28T21:30:00.000Z")).toISOString(),
    ).toBe("2026-07-29T00:00:00.000Z");
    expect(
      businessDateForIstanbul(new Date("2026-07-28T20:59:59.999Z")).toISOString(),
    ).toBe("2026-07-28T00:00:00.000Z");
  });
});
