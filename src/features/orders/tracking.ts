import "server-only";

import { hashQrToken } from "@/features/qr/crypto";
import { publicQrTokenSchema } from "@/features/qr/validation";
import { getPrisma } from "@/lib/db/prisma";

export async function getPublicOrderTracking(rawToken: string) {
  const parsed = publicQrTokenSchema.safeParse(rawToken);
  if (!parsed.success) return null;
  const order = await getPrisma().order.findUnique({
    where: { publicTokenHash: hashQrToken(parsed.data) },
    include: {
      table: { select: { name: true } },
      items: {
        include: { selectedOptions: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!order) return null;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    tableName: order.table.name,
    status: order.status,
    total: order.total.toFixed(2),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      name: item.productNameSnapshot,
      quantity: item.quantity,
      lineSubtotal: item.lineSubtotal.toFixed(2),
      options: item.selectedOptions.map(
        (option) => option.optionNameSnapshot,
      ),
    })),
  };
}

export type PublicOrderTrackingDto = NonNullable<
  Awaited<ReturnType<typeof getPublicOrderTracking>>
>;
