import { z } from "zod";
import { publicQrTokenSchema } from "../qr/validation";

export const orderItemInputSchema = z.object({
  productId: z.string().trim().min(1).max(64),
  quantity: z.number().int().min(1).max(20),
  note: z.string().trim().max(300).optional().default(""),
  optionIds: z.array(z.string().trim().min(1).max(64)).max(20).default([]),
});

export const createOrderInputSchema = z.object({
  qrToken: publicQrTokenSchema,
  idempotencyKey: z.uuid(),
  customerNote: z.string().trim().max(500).optional().default(""),
  items: z.array(orderItemInputSchema).min(1).max(50),
});

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;
