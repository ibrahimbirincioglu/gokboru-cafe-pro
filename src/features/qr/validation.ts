import { z } from "zod";

const checkbox = z.preprocess(
  (value) => value === "on" || value === "true" || value === true,
  z.boolean(),
);

export const tableSchema = z.object({
  id: z.string().trim().min(1).optional(),
  number: z.coerce.number().int().min(1).max(9999),
  name: z.string().trim().min(1).max(80),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  isActive: checkbox.default(false),
});

export const tableIdSchema = z.string().trim().min(1).max(64);
export const publicQrTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, "Geçersiz QR token biçimi.");
