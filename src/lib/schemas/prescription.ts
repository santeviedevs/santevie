import { z } from "zod";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/pagination";

const id = z.string().min(1);

// A target for one delegate/prescriber/product/month combination — the
// unique grain enforced at the database level too
// (@@unique([contactId, productId, userId, periodMonth, periodYear])).
export const createPrescriptionTargetSchema = z.object({
  contactId: id,
  productId: id,
  userId: id,
  monthlyTarget: z.coerce.number().int().positive(),
  periodMonth: z.coerce.number().int().min(1).max(12),
  periodYear: z.coerce.number().int().min(2000).max(2100),
});
export type CreatePrescriptionTargetInput = z.infer<typeof createPrescriptionTargetSchema>;

// Editing monthlyTarget on an existing target — written alongside a
// PrescriptionTargetRevision audit row in the service, same convention as
// EmballageCorrection.
export const updatePrescriptionTargetSchema = z.object({
  id,
  monthlyTarget: z.coerce.number().int().positive(),
  reason: z.string().trim().max(500).nullish(),
});
export type UpdatePrescriptionTargetInput = z.infer<typeof updatePrescriptionTargetSchema>;

// cumulativeAchieved is the new running total ("prescriptions generated so
// far"), never a delta. confirmDecrease/correctionReason are only
// meaningful when the server detects (inside the locked transaction) that
// this value is lower than the current latest — see
// prescription-service.ts's two-stage decrease handling. Shape-level
// validation only; the "reason required on a confirmed decrease" rule is
// enforced server-side against DB state, not expressible here.
export const recordPrescriptionUpdateSchema = z.object({
  targetId: id,
  cumulativeAchieved: z.coerce.number().int().min(0),
  feedback: z.string().trim().max(1000).nullish(),
  challenges: z.string().trim().max(1000).nullish(),
  followUpDate: z.iso.date().nullish(),
  confirmDecrease: z.coerce.boolean().default(false),
  correctionReason: z.string().trim().max(500).nullish(),
});
export type RecordPrescriptionUpdateInput = z.infer<typeof recordPrescriptionUpdateSchema>;

export const prescriptionTargetListParamsSchema = z.object({
  contactId: id.optional().catch(undefined),
  productId: id.optional().catch(undefined),
  periodMonth: z.coerce.number().int().min(1).max(12).optional().catch(undefined),
  periodYear: z.coerce.number().int().min(2000).max(2100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .catch(DEFAULT_PAGE_SIZE)
    .transform((value) => Math.min(value, MAX_PAGE_SIZE)),
});
export type PrescriptionTargetListParams = z.infer<typeof prescriptionTargetListParamsSchema>;
