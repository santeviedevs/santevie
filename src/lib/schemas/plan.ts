import { z } from "zod";

const id = z.string().min(1);

// A plan locks the moment its date begins — same shape of decision as
// S3-02's MAX_ACCEPTABLE_ACCURACY_METERS: a single named constant, not
// DB-editable (confirmed with the user: keep this simple for S3-06, unlike
// S3-04's attendance thresholds which the user explicitly wanted
// admin-configurable). 0 means "no grace past midnight" — a plan for today
// can no longer be edited once today has started; it must be set up the
// day before (or earlier that same day, before midnight).
export const PLAN_EDIT_CUTOFF_HOUR = 0;

// A plan with no date yet (still unassigned) is always editable — there's
// nothing for a cutoff to be relative to. Once assigned, the existing rule
// applies: editable while `now` is still strictly before the date.
export function isPlanEditable(planDate: Date | null, now: Date = new Date()): boolean {
  if (!planDate) return true;
  return now.getTime() < planDate.getTime();
}

// The Plan Visits editor's one "Save" action — `planId` empty/absent means
// "create a new plan," otherwise it's the plan being edited.
// `centerIdsInOrder` is the editor's entire desired center list, in order;
// the service diffs this against what's actually stored (nothing is
// written until this is called).
export const savePlanContentSchema = z.object({
  planId: id.nullish(),
  centerIdsInOrder: z.array(id),
});
export type SavePlanContentInput = z.infer<typeof savePlanContentSchema>;

export const reorderPlanItemsSchema = z.object({
  planId: id,
  orderedPlanItemIds: z.array(id).min(1),
});
export type ReorderPlanItemsInput = z.infer<typeof reorderPlanItemsSchema>;

export const completePlanItemSchema = z.object({
  planItemId: id,
});
export type CompletePlanItemInput = z.infer<typeof completePlanItemSchema>;

export const cancelPlanItemSchema = z.object({
  planItemId: id,
});
export type CancelPlanItemInput = z.infer<typeof cancelPlanItemSchema>;

// The one action on the Assignment screen that actually writes — covers
// both first-time assignment (plan currently unassigned) and reassignment
// (plan already assigned to someone else); the service decides which based
// on the plan's current state.
export const assignPlanSchema = z.object({
  planId: id,
  targetUserId: id,
  date: z.iso.date(),
});
export type AssignPlanInput = z.infer<typeof assignPlanSchema>;

export const cancelPlanAssignmentSchema = z.object({
  planId: id,
});
export type CancelPlanAssignmentInput = z.infer<typeof cancelPlanAssignmentSchema>;
