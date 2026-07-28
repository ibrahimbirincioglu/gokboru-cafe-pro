import { OrderStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isValidOrderTransition,
  orderItemStatusFor,
  orderStatusTimestamp,
  type ManagedOrderStatus,
} from "@/features/orders/status";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireServerPermission } from "@/lib/auth/server";
import { getPrisma } from "@/lib/db/prisma";
import { publishOrderEvent } from "@/lib/realtime/events";

const inputSchema = z.object({
  status: z.enum([
    OrderStatus.ONAYLANDI,
    OrderStatus.HAZIRLANIYOR,
    OrderStatus.HAZIR,
    OrderStatus.TAMAMLANDI,
  ]),
  version: z.number().int().positive(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireServerPermission(PERMISSIONS.ORDERS_MANAGE);
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return NextResponse.json({ error: "Geçersiz durum isteği." }, { status: 400 });
  }
  const id = (await params).id;
  const current = await getPrisma().order.findUnique({
    where: { id },
    select: { status: true, version: true },
  });
  if (
    !current ||
    current.version !== input.data.version ||
    !isValidOrderTransition(current.status, input.data.status)
  ) {
    return NextResponse.json(
      { error: "Sipariş başka bir ekranda güncellendi veya geçiş geçersiz." },
      { status: 409 },
    );
  }
  const now = new Date();
  const nextStatus = input.data.status as ManagedOrderStatus;
  const changed = await getPrisma().$transaction(async (tx) => {
    const update = await tx.order.updateMany({
      where: { id, version: current.version, status: current.status },
      data: {
        status: nextStatus,
        version: { increment: 1 },
        ...orderStatusTimestamp(nextStatus, now),
      },
    });
    if (update.count !== 1) return false;
    await tx.orderItem.updateMany({
      where: { orderId: id, status: { not: "IPTAL" } },
      data: { status: orderItemStatusFor(nextStatus) },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId: id,
        fromStatus: current.status,
        toStatus: nextStatus,
        changedByUserId: session.user.id,
        source: "CASHIER",
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "ORDER_STATUS_CHANGED",
        entityType: "Order",
        entityId: id,
        beforeJson: { status: current.status, version: current.version },
        afterJson: { status: nextStatus, version: current.version + 1 },
      },
    });
    return true;
  });
  if (!changed) {
    return NextResponse.json({ error: "Eşzamanlı güncelleme çakışması." }, { status: 409 });
  }
  publishOrderEvent("ORDER_STATUS_CHANGED", id);
  return NextResponse.json({ ok: true });
}
