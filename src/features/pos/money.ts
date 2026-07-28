import { Prisma } from "@prisma/client";

export type ChargeableItem = {
  unitPriceSnapshot: Prisma.Decimal;
  quantity: number;
  cancelledQuantity: number;
};

export function calculateSessionTotals(
  items: ChargeableItem[],
  discount: Prisma.Decimal,
) {
  const subtotal = items.reduce(
    (sum, item) =>
      sum.add(
        item.unitPriceSnapshot.mul(item.quantity - item.cancelledQuantity),
      ),
    new Prisma.Decimal(0),
  );
  if (discount.isNegative() || discount.greaterThan(subtotal)) {
    throw new Error("İndirim açık toplamdan büyük olamaz.");
  }
  return { subtotal, discount, amount: subtotal.sub(discount) };
}
