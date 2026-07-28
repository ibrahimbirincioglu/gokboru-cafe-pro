import { Prisma } from "@prisma/client";
import type { CreateOrderInput } from "./validation";

export type CatalogProduct = {
  id: string;
  name: string;
  price: Prisma.Decimal;
  discountPrice: Prisma.Decimal | null;
  prepStation: "BAR" | "MUTFAK" | "NARGILE";
  allowNote: boolean;
  isActive: boolean;
  isAvailable: boolean;
  categoryActive: boolean;
  optionGroups: Array<{
    id: string;
    minSelect: number;
    maxSelect: number;
    required: boolean;
    isActive: boolean;
    options: Array<{
      id: string;
      name: string;
      priceDelta: Prisma.Decimal;
      isActive: boolean;
    }>;
  }>;
};

export class OrderPricingError extends Error {}

export function priceOrder(
  input: Pick<CreateOrderInput, "items">,
  products: CatalogProduct[],
) {
  const byId = new Map(products.map((product) => [product.id, product]));
  let subtotal = new Prisma.Decimal(0);
  let total = new Prisma.Decimal(0);
  const items = input.items.map((item) => {
    const product = byId.get(item.productId);
    if (
      !product ||
      !product.isActive ||
      !product.isAvailable ||
      !product.categoryActive
    ) {
      throw new OrderPricingError("Ürün satışa uygun değil.");
    }
    if (item.note && !product.allowNote) {
      throw new OrderPricingError("Bu ürün için not kabul edilmiyor.");
    }
    const uniqueOptionIds = new Set(item.optionIds);
    if (uniqueOptionIds.size !== item.optionIds.length) {
      throw new OrderPricingError("Aynı seçenek iki kez seçilemez.");
    }
    const selectedOptions: Array<{
      optionId: string;
      optionNameSnapshot: string;
      priceDeltaSnapshot: Prisma.Decimal;
    }> = [];
    let optionTotal = new Prisma.Decimal(0);
    for (const group of product.optionGroups.filter((entry) => entry.isActive)) {
      const groupOptions = new Map(
        group.options
          .filter((option) => option.isActive)
          .map((option) => [option.id, option]),
      );
      const selected = item.optionIds.filter((id) => groupOptions.has(id));
      const minimum = group.required ? Math.max(1, group.minSelect) : group.minSelect;
      if (selected.length < minimum || selected.length > group.maxSelect) {
        throw new OrderPricingError("Ürün seçenek sayısı geçersiz.");
      }
      for (const optionId of selected) {
        const option = groupOptions.get(optionId)!;
        optionTotal = optionTotal.add(option.priceDelta);
        selectedOptions.push({
          optionId,
          optionNameSnapshot: option.name,
          priceDeltaSnapshot: option.priceDelta,
        });
      }
    }
    if (selectedOptions.length !== item.optionIds.length) {
      throw new OrderPricingError("Geçersiz veya pasif ürün seçeneği.");
    }
    const basePrice =
      product.discountPrice && product.discountPrice.lessThan(product.price)
        ? product.discountPrice
        : product.price;
    const unitPrice = basePrice.add(optionTotal);
    const listUnitPrice = product.price.add(optionTotal);
    const lineSubtotal = unitPrice.mul(item.quantity);
    subtotal = subtotal.add(listUnitPrice.mul(item.quantity));
    total = total.add(lineSubtotal);
    return {
      productId: product.id,
      productNameSnapshot: product.name,
      unitPriceSnapshot: unitPrice,
      quantity: item.quantity,
      lineSubtotal,
      note: item.note || null,
      prepStation: product.prepStation,
      selectedOptions,
    };
  });
  return {
    items,
    subtotal,
    discountTotal: subtotal.sub(total),
    total,
  };
}
