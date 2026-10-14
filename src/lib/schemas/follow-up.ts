import { z } from "zod";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/pagination";

const id = z.string().min(1);

// Scoped to one assignment, not the bare activity: with several people
// possibly assigned to the same activity, a follow-up belongs to whichever
// assignment it was raised against.
export const createFollowUpSchema = z.object({
  assignmentId: id,
  dueDate: z.iso.date(),
});
export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>;

// Outcome capture on completion — structured fields (not just free text) so
// reports can aggregate business value / filter on product availability
// rather than that data being locked inside a text blob. All optional:
// which ones actually apply depends on the activity type the UI is showing
// (same "gate in the UI, accept the superset on the server" pattern as
// activity execution — see activity-type-fields.ts).
export const completeFollowUpSchema = z.object({
  id,
  outcome: z.string().max(2000).optional(),
  prescriptionsGenerated: z.coerce.number().int().min(0).optional(),
  businessValueGenerated: z.coerce.number().min(0).optional(),
  productAvailable: z
    .union([z.literal("true"), z.literal("false")])
    .transform((v) => v === "true")
    .optional(),
});
export type CompleteFollowUpInput = z.infer<typeof completeFollowUpSchema>;

// Reassignment updates the current FollowUp row's owner in place (unlike
// assignment reassignment, which cancels and recreates) — a manager-level
// action, gated behind activities:assign same as reassignAssignment.
export const reassignFollowUpSchema = z.object({
  id,
  newOwnerId: id,
});
export type ReassignFollowUpInput = z.infer<typeof reassignFollowUpSchema>;

// URL query of the My/Team Follow-Ups tables — same shape and clamping
// convention as activityListParamsSchema. No `status` means every status
// (both tables double as completed-follow-up history, not a PENDING-only
// work queue). `overdueOnly` narrows to past-due PENDING follow-ups and
// overrides `status` if both are somehow present — see the schema comment
// on FollowUpQuery.overdueOnly.
export const followUpListParamsSchema = z.object({
  q: z.string().trim().max(200).optional().catch(undefined),
  typeId: id.optional().catch(undefined),
  status: z.enum(["PENDING", "DONE"]).optional().catch(undefined),
  overdueOnly: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .catch(undefined)
    .transform((v) => v === "true"),
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
export type FollowUpListParams = z.infer<typeof followUpListParamsSchema>;
