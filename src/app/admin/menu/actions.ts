"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  categorySchema,
  optionGroupSchema,
  optionSchema,
  productSchema,
  toDecimal,
  toSlug,
} from "@/features/catalog/validation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireServerPermission } from "@/lib/auth/server";
import { getPrisma } from "@/lib/db/prisma";

function formValues(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function catalogError(error: unknown, returnPath: string): never {
  const code =
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
      ? "duplicate"
      : "invalid";
  redirect(`${returnPath}?error=${code}`);
}

export async function createCategoryAction(formData: FormData) {
  const session = await requireServerPermission(PERMISSIONS.MENU_MANAGE);
  const returnPath = "/admin/menu/categories";

  try {
    const input = categorySchema.parse(formValues(formData));
    const slug = toSlug(input.name);
    const prisma = getPrisma();
    await prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: { ...input, slug },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: session.user.id,
          action: "CATEGORY_CREATED",
          entityType: "Category",
          entityId: category.id,
          afterJson: auditJson({ ...input, slug }),
        },
      });
    });
  } catch (error) {
    catalogError(error, returnPath);
  }

  revalidatePath(returnPath);
}

export async function updateCategoryAction(formData: FormData) {
  const session = await requireServerPermission(PERMISSIONS.MENU_MANAGE);
  const returnPath = "/admin/menu/categories";

  try {
    const input = categorySchema.parse(formValues(formData));
    if (!input.id) throw new Error("Kategori kimliği gerekli.");
    const { id, ...data } = input;
    const prisma = getPrisma();
    await prisma.$transaction(async (tx) => {
      const before = await tx.category.findUniqueOrThrow({ where: { id } });
      const after = await tx.category.update({
        where: { id },
        data: { ...data, slug: toSlug(data.name) },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: session.user.id,
          action: "CATEGORY_UPDATED",
          entityType: "Category",
          entityId: id,
          beforeJson: auditJson(before),
          afterJson: auditJson(after),
        },
      });
    });
  } catch (error) {
    catalogError(error, returnPath);
  }

  revalidatePath(returnPath);
}

export async function deactivateCategoryAction(formData: FormData) {
  const session = await requireServerPermission(PERMISSIONS.MENU_MANAGE);
  const id = String(formData.get("id") ?? "");
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    const before = await tx.category.findUniqueOrThrow({ where: { id } });
    const after = await tx.category.update({
      where: { id },
      data: { isActive: false },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "CATEGORY_DEACTIVATED",
        entityType: "Category",
        entityId: id,
        beforeJson: auditJson(before),
        afterJson: auditJson(after),
      },
    });
  });
  revalidatePath("/admin/menu/categories");
}

export async function createProductAction(formData: FormData) {
  const session = await requireServerPermission(PERMISSIONS.MENU_MANAGE);
  const returnPath = "/admin/menu/products";

  try {
    const input = productSchema.parse(formValues(formData));
    const data = productData(input);
    const prisma = getPrisma();
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({ data });
      await tx.auditLog.create({
        data: {
          actorUserId: session.user.id,
          action: "PRODUCT_CREATED",
          entityType: "Product",
          entityId: product.id,
          afterJson: auditJson(serializeProduct(product)),
        },
      });
    });
  } catch (error) {
    catalogError(error, returnPath);
  }

  revalidatePath(returnPath);
}

export async function updateProductAction(formData: FormData) {
  const session = await requireServerPermission(PERMISSIONS.MENU_MANAGE);
  const returnPath = "/admin/menu/products";

  try {
    const input = productSchema.parse(formValues(formData));
    if (!input.id) throw new Error("Ürün kimliği gerekli.");
    const id = input.id;
    const prisma = getPrisma();
    await prisma.$transaction(async (tx) => {
      const before = await tx.product.findUniqueOrThrow({ where: { id } });
      const after = await tx.product.update({
        where: { id },
        data: productData(input),
      });
      await tx.auditLog.create({
        data: {
          actorUserId: session.user.id,
          action: "PRODUCT_UPDATED",
          entityType: "Product",
          entityId: id,
          beforeJson: auditJson(serializeProduct(before)),
          afterJson: auditJson(serializeProduct(after)),
        },
      });
    });
  } catch (error) {
    catalogError(error, returnPath);
  }

  revalidatePath(returnPath);
}

export async function deactivateProductAction(formData: FormData) {
  const session = await requireServerPermission(PERMISSIONS.MENU_MANAGE);
  const id = String(formData.get("id") ?? "");
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    const before = await tx.product.findUniqueOrThrow({ where: { id } });
    const after = await tx.product.update({
      where: { id },
      data: { isActive: false, isAvailable: false },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "PRODUCT_DEACTIVATED",
        entityType: "Product",
        entityId: id,
        beforeJson: auditJson(serializeProduct(before)),
        afterJson: auditJson(serializeProduct(after)),
      },
    });
  });
  revalidatePath("/admin/menu/products");
}

export async function toggleAvailabilityAction(formData: FormData) {
  const session = await requireServerPermission(PERMISSIONS.MENU_MANAGE);
  const id = String(formData.get("id") ?? "");
  const isAvailable = formData.get("isAvailable") === "true";
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    const before = await tx.product.findUniqueOrThrow({ where: { id } });
    const after = await tx.product.update({
      where: { id },
      data: { isAvailable },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "PRODUCT_AVAILABILITY_CHANGED",
        entityType: "Product",
        entityId: id,
        beforeJson: auditJson(serializeProduct(before)),
        afterJson: auditJson(serializeProduct(after)),
      },
    });
  });
  revalidatePath("/admin/menu/products");
}

export async function saveOptionGroupAction(formData: FormData) {
  const session = await requireServerPermission(PERMISSIONS.MENU_MANAGE);
  const productId = String(formData.get("productId") ?? "");
  const returnPath = `/admin/menu/products/${productId}/options`;
  try {
    const input = optionGroupSchema.parse(formValues(formData));
    const { id, ...data } = input;
    const prisma = getPrisma();
    await prisma.$transaction(async (tx) => {
      const group = id
        ? await tx.productOptionGroup.update({ where: { id }, data })
        : await tx.productOptionGroup.create({ data });
      await tx.auditLog.create({
        data: {
          actorUserId: session.user.id,
          action: id ? "PRODUCT_OPTION_GROUP_UPDATED" : "PRODUCT_OPTION_GROUP_CREATED",
          entityType: "ProductOptionGroup",
          entityId: group.id,
          afterJson: auditJson(group),
        },
      });
    });
  } catch (error) {
    catalogError(error, returnPath);
  }
  revalidatePath(returnPath);
}

export async function saveOptionAction(formData: FormData) {
  const session = await requireServerPermission(PERMISSIONS.MENU_MANAGE);
  const productId = String(formData.get("productId") ?? "");
  const returnPath = `/admin/menu/products/${productId}/options`;
  try {
    const input = optionSchema.parse(formValues(formData));
    const { id, priceDelta, ...rest } = input;
    const data = { ...rest, priceDelta: toDecimal(priceDelta) };
    const prisma = getPrisma();
    await prisma.$transaction(async (tx) => {
      const option = id
        ? await tx.productOption.update({ where: { id }, data })
        : await tx.productOption.create({ data });
      await tx.auditLog.create({
        data: {
          actorUserId: session.user.id,
          action: id ? "PRODUCT_OPTION_UPDATED" : "PRODUCT_OPTION_CREATED",
          entityType: "ProductOption",
          entityId: option.id,
          afterJson: auditJson({
            ...option,
            priceDelta: option.priceDelta.toFixed(2),
          }),
        },
      });
    });
  } catch (error) {
    catalogError(error, returnPath);
  }
  revalidatePath(returnPath);
}

export async function deactivateOptionEntityAction(formData: FormData) {
  const session = await requireServerPermission(PERMISSIONS.MENU_MANAGE);
  const id = String(formData.get("id") ?? "");
  const type = String(formData.get("type") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    if (type === "group") {
      await tx.productOptionGroup.update({
        where: { id },
        data: { isActive: false },
      });
    } else {
      await tx.productOption.update({
        where: { id },
        data: { isActive: false },
      });
    }
    await tx.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: type === "group" ? "PRODUCT_OPTION_GROUP_DEACTIVATED" : "PRODUCT_OPTION_DEACTIVATED",
        entityType: type === "group" ? "ProductOptionGroup" : "ProductOption",
        entityId: id,
      },
    });
  });
  revalidatePath(`/admin/menu/products/${productId}/options`);
}

function productData(input: ReturnType<typeof productSchema.parse>) {
  return {
    categoryId: input.categoryId,
    name: input.name,
    slug: toSlug(input.name),
    description: input.description,
    imageUrl: input.imageUrl,
    price: toDecimal(input.price),
    discountPrice: input.discountPrice
      ? toDecimal(input.discountPrice)
      : null,
    prepStation: input.prepStation,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
    isAvailable: input.isAvailable,
    isFeatured: input.isFeatured,
    allowNote: input.allowNote,
  };
}

function serializeProduct<T extends { price: Prisma.Decimal; discountPrice: Prisma.Decimal | null }>(product: T) {
  return {
    ...product,
    price: product.price.toFixed(2),
    discountPrice: product.discountPrice?.toFixed(2) ?? null,
  };
}

function auditJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
