import { z } from "zod";

const id = z.string().min(1);

// A route locks the moment its date begins — same shape of decision as
// S3-02's MAX_ACCEPTABLE_ACCURACY_METERS: a single named constant, not
// DB-editable (confirmed with the user: keep this simple for S3-06, unlike
// S3-04's attendance thresholds which the user explicitly wanted
// admin-configurable). 0 means "no grace past midnight" — a route for today
// can no longer be edited once today has started; it must be set up the
// day before (or earlier that same day, before midnight).
// Why a saved Contact on a route is flagged: its Contact<->Center link was
// removed since, or the Contact went inactive. Lives here (not in the
// service) because client components display it.
export type RouteContactIssue = "NOT_ASSOCIATED" | "INACTIVE";

export const ROUTE_EDIT_CUTOFF_HOUR = 0;

// A route with no date yet (still unassigned) is always editable — there's
// nothing for a cutoff to be relative to. Once assigned, the existing rule
// applies: editable while `now` is still strictly before the date.
export function isRouteEditable(routeDate: Date | null, now: Date = new Date()): boolean {
  if (!routeDate) return true;
  return now.getTime() < routeDate.getTime();
}

// Hard ceiling on a type-ahead result list — the Center and Contact search
// endpoints never return more than this, however large the dataset.
export const ROUTE_SEARCH_LIMIT = 20;

// One stop on a route: a Center plus the Contacts the visitor is meant to
// see there (optional — a Center may have none selected). Only the ids
// cross the boundary; the server re-validates every Center and every
// Center–Contact pair itself and never trusts the client's grouping.
export const routeSelectionSchema = z
  .object({
    centerId: id,
    contactIds: z.array(id),
  })
  .refine((selection) => new Set(selection.contactIds).size === selection.contactIds.length, {
    message: "A contact can only be selected once per center.",
    path: ["contactIds"],
  });
export type RouteSelectionInput = z.infer<typeof routeSelectionSchema>;

// The Plan Routes editor's one "Save" action — `routeId` empty/absent means
// "create a new route," otherwise it's the route being edited.
// `selections` is the editor's entire desired (still-editable) content, in
// order; the service diffs this against what's actually stored (nothing is
// written until this is called).
export const saveRouteContentSchema = z.object({
  routeId: id.nullish(),
  selections: z
    .array(routeSelectionSchema)
    .refine((selections) => new Set(selections.map((s) => s.centerId)).size === selections.length, {
      message: "A center can only be added to a route once.",
    }),
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

export const completeRouteItemContactSchema = z.object({
  routeItemContactId: id,
});
export type CompleteRouteItemContactInput = z.infer<typeof completeRouteItemContactSchema>;

export const cancelRouteItemContactSchema = z.object({
  routeItemContactId: id,
});
export type CancelRouteItemContactInput = z.infer<typeof cancelRouteItemContactSchema>;

// GET query params for the two type-ahead endpoints. `routeId` is optional:
// present while editing an existing route (the territory owner is then the
// route's visitor/creator), absent on a brand-new route (the actor).
const searchText = z.string().trim().max(100).default("");
const searchLimit = z.coerce
  .number()
  .int()
  .min(1)
  .max(ROUTE_SEARCH_LIMIT)
  .default(ROUTE_SEARCH_LIMIT);

export const centerSearchQuerySchema = z.object({
  q: searchText,
  territoryId: id.optional(),
  routeId: id.optional(),
  limit: searchLimit,
});
export type CenterSearchQuery = z.infer<typeof centerSearchQuerySchema>;

export const contactSearchQuerySchema = z.object({
  q: searchText,
  routeId: id.optional(),
  limit: searchLimit,
});
export type ContactSearchQuery = z.infer<typeof contactSearchQuerySchema>;

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
