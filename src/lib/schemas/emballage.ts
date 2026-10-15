import { z } from "zod";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/pagination";

const id = z.string().min(1);

// A single collection event — centre, product, date and quantity. Logging
// the same centre/product/date combination again is allowed and expected
// (repeated visits to the same centre each get their own row, never
// merged), so there's no uniqueness constraint here.
export const createEmballageCollectionSchema = z.object({
  centerId: id,
  productId: id,
  visitDate: z.iso.date(),
  quantity: z.coerce.number().positive(),
  remarks: z.string().trim().max(1000).nullish(),
});
export type CreateEmballageCollectionInput = z.infer<typeof createEmballageCollectionSchema>;

// Corrects an existing row's quantity in place rather than appending a
// negative-offset row — reason is optional, matching the agreed "warn and
// allow" correction UX (no mandatory justification).
export const correctEmballageCollectionSchema = z.object({
  id,
  quantity: z.coerce.number().positive(),
  reason: z.string().trim().max(500).nullish(),
});
export type CorrectEmballageCollectionInput = z.infer<typeof correctEmballageCollectionSchema>;

// Finalizes one calendar month's EOM reconciliation — locks every
// collection row with a visitDate in that month.
export const finalizeEmballageReportSchema = z.object({
  periodMonth: z.coerce.number().int().min(1).max(12),
  periodYear: z.coerce.number().int().min(2000).max(2100),
});
export type FinalizeEmballageReportInput = z.infer<typeof finalizeEmballageReportSchema>;

export const emballageListParamsSchema = z.object({
  centerId: id.optional().catch(undefined),
  productId: id.optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .catch(DEFAULT_PAGE_SIZE)
    .transform((value) => Math.min(value, MAX_PAGE_SIZE)),
});
export type EmballageListParams = z.infer<typeof emballageListParamsSchema>;

// EOM centre-wise x product-wise reconciliation report filters — a single
// calendar month, optionally narrowed to one centre and/or one product.
export const emballageReportParamsSchema = z.object({
  periodMonth: z.coerce.number().int().min(1).max(12),
  periodYear: z.coerce.number().int().min(2000).max(2100),
  centerId: id.optional().catch(undefined),
  productId: id.optional().catch(undefined),
});
export type EmballageReportParams = z.infer<typeof emballageReportParamsSchema>;
