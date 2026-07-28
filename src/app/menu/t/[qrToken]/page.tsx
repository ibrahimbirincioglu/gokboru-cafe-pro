import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuestMenu } from "@/components/guest-menu/guest-menu";
import { hashQrToken } from "@/features/qr/crypto";
import { resolveActiveTableByQrToken } from "@/features/qr/server";
import { getPrisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Masa Menüsü" };
export const dynamic = "force-dynamic";

export default async function PublicTableMenuPage({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  const { qrToken } = await params;
  const table = await resolveActiveTableByQrToken(qrToken);
  if (!table) notFound();
  const categories = await getPrisma().category.findMany({
    where: { isActive: true, products: { some: { isActive: true, isAvailable: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      products: {
        where: { isActive: true, isAvailable: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          optionGroups: {
            where: { isActive: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            include: {
              options: {
                where: { isActive: true },
                orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
              },
            },
          },
        },
      },
    },
  });
  const menu = categories.map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    products: category.products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      imageUrl: product.imageUrl,
      price: product.price.toFixed(2),
      discountPrice: product.discountPrice?.toFixed(2) ?? null,
      allowNote: product.allowNote,
      optionGroups: product.optionGroups.map((group) => ({
        id: group.id,
        name: group.name,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        required: group.required,
        options: group.options.map((option) => ({
          id: option.id,
          name: option.name,
          priceDelta: option.priceDelta.toFixed(2),
        })),
      })),
    })),
  }));

  return (
    <GuestMenu
      cartKey={hashQrToken(qrToken).slice(0, 20)}
      categories={menu}
      qrToken={qrToken}
      tableName={table.name}
    />
  );
}
