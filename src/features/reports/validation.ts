import { z } from "zod";

const optionalId = z.string().trim().max(64).optional().default("");

export const historyFilterSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeFrom: z.string().regex(/^\d{2}:\d{2}$/).optional().default(""),
  timeTo: z.string().regex(/^\d{2}:\d{2}$/).optional().default(""),
  tableId: optionalId,
  productId: optionalId,
  status: z.enum(["", "BEKLIYOR", "ONAYLANDI", "HAZIRLANIYOR", "HAZIR", "TAMAMLANDI", "IPTAL"]).optional().default(""),
  paymentType: z.enum(["", "NAKIT", "KREDI_KARTI"]).optional().default(""),
  employeeId: optionalId,
  page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
});

export type HistoryFilters = z.infer<typeof historyFilterSchema>;
