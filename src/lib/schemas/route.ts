import { z } from "zod";

const id = z.string().min(1);

// A route locks the moment its date begins — same shape of decision as
// S3-02's MAX_ACCEPTABLE_ACCURACY_METERS: a single named constant, not
// DB-editable (confirmed with the user: keep this simple for S3-06, unlike
// S3-04's attendance thresholds which the user explicitly wanted
// admin-configurable). 0 means "no grace past midnight" — a route for today
// can no longer be edited once today has started; it must be set up the
// day before (or earlier that same day, before midnight).
export const ROUTE_EDIT_CUTOFF_HOUR = 0;

// A route with no date yet (still unassigned) is always editable — there's
// nothing for a cutoff to be relative to. Once assigned, the existing rule
// applies: editable while `now` is still strictly before the date.
export function isRouteEditable(routeDate: Date | null, now: Date = new Date()): boolean {
  if (!routeDate) return true;
  return now.getTime() < routeDate.getTime();
}

// The Route Visits editor's one "Save" action — `routeId` empty/absent means
// "create a new route," otherwise it's the route being edited.
// `centerIdsInOrder` is the editor's entire desired center list, in order;
// the service diffs this against what's actually stored (nothing is
// written until this is called).
export const saveRouteContentSchema = z.object({
  routeId: id.nullish(),
  centerIdsInOrder: z.array(id),
});
export type SaveRouteContentInput = z.infer<typeof saveRouteContentSchema>;

export const reorderRouteItemsSchema = z.object({
  routeId: id,
  orderedRouteItemIds: z.array(id).min(1),
});
export type ReorderRouteItemsInput = z.infer<typeof reorderRouteItemsSchema>;

export const completeRouteItemSchema = z.object({
  routeItemId: id,
});
export type CompleteRouteItemInput = z.infer<typeof completeRouteItemSchema>;

export const cancelRouteItemSchema = z.object({
  routeItemId: id,
});
export type CancelRouteItemInput = z.infer<typeof cancelRouteItemSchema>;

// The one action on the Assignment screen that actually writes — covers
// both first-time assignment (route currently unassigned) and reassignment
// (route already assigned to someone else); the service decides which based
// on the route's current state.
export const assignRouteSchema = z.object({
  routeId: id,
  targetUserId: id,
  date: z.iso.date(),
});
export type AssignRouteInput = z.infer<typeof assignRouteSchema>;

export const cancelRouteAssignmentSchema = z.object({
  routeId: id,
});
export type CancelRouteAssignmentInput = z.infer<typeof cancelRouteAssignmentSchema>;
