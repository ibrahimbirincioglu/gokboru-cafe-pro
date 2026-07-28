import { describe, expect, it } from "vitest";
import {
  categorySchema,
  optionGroupSchema,
  optionSchema,
  productSchema,
  toDecimal,
  toSlug,
} from "../src/features/catalog/validation";

const validProduct = {
  categoryId: "category-1",
  name: "Gökbörü Burger",
  description: "Özel burger",
  imageUrl: "https://images.example.com/burger.jpg",
  price: "250,90",
  discountPrice: "225.50",
  prepStation: "MUTFAK",
  sortOrder: "10",
  isActive: "on",
  isAvailable: "on",
  isFeatured: "on",
  allowNote: "on",
};

describe("catalog validation", () => {
  it("normalizes Turkish names into stable slugs", () => {
    expect(toSlug("  Sıcak İçecekler & Çay  ")).toBe(
      "sicak-icecekler-cay",
    );
  });

  it("accepts exact comma or dot decimal prices", () => {
    const parsed = productSchema.parse(validProduct);

    expect(toDecimal(parsed.price).toFixed(2)).toBe("250.90");
    expect(toDecimal(parsed.discountPrice!).toFixed(2)).toBe("225.50");
  });

  it("rejects floating-point-like malformed and oversized prices", () => {
    expect(() =>
      productSchema.parse({ ...validProduct, price: "12.345" }),
    ).toThrow();
    expect(() =>
      productSchema.parse({ ...validProduct, price: "12345678901.00" }),
    ).toThrow();
  });

  it("requires discount price to be lower than the normal price", () => {
    expect(() =>
      productSchema.parse({
        ...validProduct,
        discountPrice: "300.00",
      }),
    ).toThrow(/İndirimli fiyat/);
  });

  it("accepts HTTPS image URLs and rejects unsafe protocols", () => {
    expect(
      categorySchema.parse({
        name: "Tatlılar",
        description: "",
        imageUrl: "https://images.example.com/tatlilar.jpg",
        sortOrder: "1",
        isActive: "on",
      }).imageUrl,
    ).toMatch(/^https:/);

    expect(() =>
      categorySchema.parse({
        name: "Tatlılar",
        imageUrl: "javascript:alert(1)",
        sortOrder: "1",
        isActive: "on",
      }),
    ).toThrow();
  });

  it("validates option selection limits", () => {
    expect(() =>
      optionGroupSchema.parse({
        productId: "product-1",
        name: "Ekstralar",
        minSelect: "2",
        maxSelect: "1",
        sortOrder: "0",
      }),
    ).toThrow(/Minimum seçim/);
  });

  it("supports exact positive and negative option price deltas", () => {
    const option = optionSchema.parse({
      groupId: "group-1",
      name: "Ekstra peynir",
      priceDelta: "-10,25",
      sortOrder: "0",
      isActive: "on",
    });

    expect(toDecimal(option.priceDelta).toFixed(2)).toBe("-10.25");
  });
});
