"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { newStoredQrToken } from "@/features/qr/server";
import { tableIdSchema, tableSchema } from "@/features/qr/validation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireServerPermission } from "@/lib/auth/server";
import { getPrisma } from "@/lib/db/prisma";

const returnPath = "/admin/tables";

function formValues(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function tableError(error: unknown): never {
  const code =
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
      ? "duplicate"
      : "invalid";
  redirect(`${returnPath}?error=${code}`);
}

export async function createTableAction(formData: FormData) {
  const session = await requireServerPermission(PERMISSIONS.TABLES_MANAGE);
  try {
    const input = tableSchema.parse(formValues(formData));
    const data = {
      number: input.number,
      name: input.name,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    };
    const qr = newStoredQrToken();
    await getPrisma().$transaction(async (tx) => {
      const table = await tx.table.create({
        data: {
          ...data,
          qrTokenHash: qr.hash,
          qrTokenEncrypted: qr.encrypted,
          qrTokenVersion: 1,
          qrRotatedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: session.user.id,
          action: "TABLE_CREATED",
          entityType: "Table",
          entityId: table.id,
          afterJson: safeTableAudit(table),
        },
      });
    });
  } catch (error) {
    tableError(error);
  }
  revalidatePath(returnPath);
}

export async function updateTableAction(formData: FormData) {
  const session = await requireServerPermission(PERMISSIONS.TABLES_MANAGE);
  try {
    const input = tableSchema.parse(formValues(formData));
    if (!input.id) throw new Error("Masa kimliği gerekli.");
    const { id, ...data } = input;
    await getPrisma().$transaction(async (tx) => {
      const before = await tx.table.findUniqueOrThrow({ where: { id } });
      const after = await tx.table.update({ where: { id }, data });
      await tx.auditLog.create({
        data: {
          actorUserId: session.user.id,
          action: "TABLE_UPDATED",
          entityType: "Table",
          entityId: id,
          beforeJson: safeTableAudit(before),
          afterJson: safeTableAudit(after),
        },
      });
    });
  } catch (error) {
    tableError(error);
  }
  revalidatePath(returnPath);
}

export async function deactivateTableAction(formData: FormData) {
  const session = await requireServerPermission(PERMISSIONS.TABLES_MANAGE);
  const id = tableIdSchema.parse(formData.get("id"));
  await getPrisma().$transaction(async (tx) => {
    const before = await tx.table.findUniqueOrThrow({ where: { id } });
    const after = await tx.table.update({
      where: { id },
      data: { isActive: false },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "TABLE_DEACTIVATED",
        entityType: "Table",
        entityId: id,
        beforeJson: safeTableAudit(before),
        afterJson: safeTableAudit(after),
      },
    });
  });
  revalidatePath(returnPath);
}

export async function rotateTableQrAction(formData: FormData) {
  const session = await requireServerPermission(PERMISSIONS.TABLES_MANAGE);
  const id = tableIdSchema.parse(formData.get("id"));
  const qr = newStoredQrToken();
  await getPrisma().$transaction(async (tx) => {
    const table = await tx.table.update({
      where: { id },
      data: {
        qrTokenHash: qr.hash,
        qrTokenEncrypted: qr.encrypted,
        qrTokenVersion: { increment: 1 },
        qrRotatedAt: new Date(),
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "TABLE_QR_ROTATED",
        entityType: "Table",
        entityId: id,
        safeMetadata: {
          qrTokenVersion: table.qrTokenVersion,
        },
      },
    });
  });
  revalidatePath(returnPath);
}

function safeTableAudit(table: {
  id: string;
  number: number;
  name: string;
  isActive: boolean;
  sortOrder: number;
  qrTokenVersion: number;
  qrRotatedAt: Date | null;
}) {
  return {
    id: table.id,
    number: table.number,
    name: table.name,
    isActive: table.isActive,
    sortOrder: table.sortOrder,
    qrTokenVersion: table.qrTokenVersion,
    qrRotatedAt: table.qrRotatedAt?.toISOString() ?? null,
  };
}
