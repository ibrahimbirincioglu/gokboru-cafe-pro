import { z } from "zod";
import { orderItemInputSchema } from "@/features/orders/validation";

export const cashierOrderSchema = z.object({
  idempotencyKey: z.uuid(),
  customerNote: z.string().trim().max(500).optional().default(""),
  items: z.array(orderItemInputSchema).min(1).max(50),
});

export const cancelItemSchema = z.object({
  itemId: z.string().trim().min(1).max(64),
  quantity: z.number().int().min(1).max(20),
  reason: z.string().trim().min(3).max(300),
});

export const discountSchema = z.object({
  amount: z.string().regex(/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/),
  reason: z.string().trim().min(3).max(300),
});

export const paymentSchema = z.object({
  idempotencyKey: z.uuid(),
  paymentType: z.enum(["NAKIT", "KREDI_KARTI"]),
});
