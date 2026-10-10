import { z } from "zod";

import { MAX_PAGE_SIZE } from "@/lib/pagination";
import { todayInKinshasa } from "@/lib/week";

const id = z.string().min(1);

// A route locks the moment its startDate begins (in Africa/Kinshasa) — same
// shape of decision as S3-02's MAX_ACCEPTABLE_ACCURACY_METERS: a single
// rule, not DB-editable (confirmed with the user: keep this simple for
// S3-06, unlike S3-04's attendance thresholds which the user explicitly
// wanted admin-configurable). A route for today can no longer be edited
// once today has started; it must be set up the day before.

// Why a saved Contact on a route is flagged: its Contact<->Center link was
// removed since, or the Contact went inactive. Lives here (not in the
// service) because client components display it.
export type RouteContactIssue = "NOT_ASSOCIATED" | "INACTIVE";

// A route with no start date yet (still unassigned) is always editable —
// there's nothing for a cutoff to be relative to. Once assigned, it is
// editable while today (Kinshasa) is strictly before the start date.
export function isRouteEditable(startDate: Date | null, now: Date = new Date()): boolean {
  if (!startDate) return true;
  return todayInKinshasa(now).getTime() < startDate.getTime();
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

// Assigning (or reassigning) a route: who, and for which date range. The
// range is flexible — any start..end, end not before start. "Start not
// before today" needs the clock, so the service checks it; the schema only
// checks the shape.
export const assignRouteSchema = z
  .object({
    routeId: id,
    targetUserId: id,
    startDate: z.iso.date(),
    endDate: z.iso.date(),
  })
  .refine((input) => input.endDate >= input.startDate, {
    message: "The end date can't be before the start date.",
    path: ["endDate"],
  });
export type AssignRouteInput = z.infer<typeof assignRouteSchema>;

export const cancelRouteAssignmentSchema = z.object({
  routeId: id,
});
export type CancelRouteAssignmentInput = z.infer<typeof cancelRouteAssignmentSchema>;

// The route's status as shown in the Assign Routes table. Never stored — it
// is derived from the assignment and the items' statuses (see
// deriveRouteStatus in route-service.ts).
export const ROUTE_STATUSES = [
  "UNASSIGNED",
  "ASSIGNED",
  "IN_PROGRESS",
  "MISSED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type RouteStatus = (typeof ROUTE_STATUSES)[number];

// The Assign Routes table lists existing assignments only, so UNASSIGNED is
// not something it can be filtered by (unassigned routes are picked in the
// form above it instead).
export const ROUTE_FILTER_STATUSES = ROUTE_STATUSES.filter(
  (status): status is Exclude<RouteStatus, "UNASSIGNED"> => status !== "UNASSIGNED",
);

// Type-ahead for the assign form's two dropdowns (unassigned routes; users
// the actor may assign to). Same bounded-result convention as the center
// and contact searches.
export const routeSearchQuerySchema = z.object({
  q: searchText,
  limit: searchLimit,
});
export type RouteSearchQuery = z.infer<typeof routeSearchQuerySchema>;

export const assigneeSearchQuerySchema = z.object({
  q: searchText,
  limit: searchLimit,
});
export type AssigneeSearchQuery = z.infer<typeof assigneeSearchQuerySchema>;

export const ROUTE_TABLE_PAGE_SIZE = 10;

// URL query of the Assign Routes table. Every field degrades to "absent"
// when malformed rather than failing the whole page (same stance as
// paginationParamsSchema): a bad query string should still render a table.
export const routeFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  assigneeId: id.optional().catch(undefined),
  status: z.enum(ROUTE_FILTER_STATUSES).optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .catch(ROUTE_TABLE_PAGE_SIZE)
    .transform((value) => Math.min(value, MAX_PAGE_SIZE)),
});
export type RouteFilters = z.infer<typeof routeFiltersSchema>;
