import { PrepStation, Prisma } from "@prisma/client";
import { z } from "zod";

const optionalText = (max: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === ""
        ? undefined
        : value,
    z.string().trim().max(max).optional(),
  );

const checkbox = z.preprocess(
  (value) => value === "on" || value === "true" || value === true,
  z.boolean(),
);

const sortOrder = z.coerce.number().int().min(0).max(100_000);
const id = z.string().trim().min(1).max(64);
const moneyPattern = /^(?:0|[1-9]\d{0,9})(?:[.,]\d{1,2})?$/;
const signedMoneyPattern = /^-?(?:0|[1-9]\d{0,9})(?:[.,]\d{1,2})?$/;

export const categorySchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(2).max(100),
  description: optionalText(500),
  imageUrl: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === ""
        ? undefined
        : value,
    z
      .string()
      .url()
      .max(2_000)
      .refine((value) => new URL(value).protocol === "https:", {
        message: "Fotoğraf adresi HTTPS olmalıdır.",
      })
      .optional(),
  ),
  sortOrder,
  isActive: checkbox,
});

export const productSchema = z
  .object({
    id: id.optional(),
    categoryId: id,
    name: z.string().trim().min(2).max(120),
    description: optionalText(1_000),
    imageUrl: categorySchema.shape.imageUrl,
    price: z.string().trim().regex(moneyPattern),
    discountPrice: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() === ""
          ? undefined
          : value,
      z.string().trim().regex(moneyPattern).optional(),
    ),
    prepStation: z.enum(PrepStation),
    sortOrder,
    isActive: checkbox,
    isAvailable: checkbox,
    isFeatured: checkbox,
    allowNote: checkbox,
  })
  .refine(
    (value) =>
      !value.discountPrice ||
      new Prisma.Decimal(value.discountPrice.replace(",", ".")).lessThan(
        new Prisma.Decimal(value.price.replace(",", ".")),
      ),
    {
      message: "İndirimli fiyat normal fiyattan düşük olmalıdır.",
      path: ["discountPrice"],
    },
  );

export const optionGroupSchema = z
  .object({
    id: id.optional(),
    productId: id,
    name: z.string().trim().min(2).max(100),
    minSelect: z.coerce.number().int().min(0).max(50),
    maxSelect: z.coerce.number().int().min(1).max(50),
    required: checkbox,
    isActive: checkbox,
    sortOrder,
  })
  .refine((value) => value.minSelect <= value.maxSelect, {
    message: "Minimum seçim maksimum seçimden büyük olamaz.",
    path: ["minSelect"],
  });

export const optionSchema = z.object({
  id: id.optional(),
  groupId: id,
  name: z.string().trim().min(1).max(100),
  priceDelta: z.string().trim().regex(signedMoneyPattern),
  isActive: checkbox,
  sortOrder,
});

export function toSlug(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

export function toDecimal(value: string) {
  return new Prisma.Decimal(value.replace(",", "."));
}
