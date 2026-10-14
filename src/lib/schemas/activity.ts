import { z } from "zod";

import { MAX_PAGE_SIZE } from "@/lib/pagination";

const id = z.string().min(1);

const activityAssignmentStatus = z.enum(["PLANNED", "DONE", "CANCELLED"]);

const activityProductInput = z.object({
  productId: id,
  availability: z.string().trim().max(200).nullish(),
});

// Shared/planned fields every standard-event Activity type carries — name,
// the admin-maintained type (ActivityTypeDef, not a hardcoded enum), where
// it happens (which of center+territory/location/department applies, and
// whether any of them is required, is type-specific — gated client-side by
// activity-type-fields.ts, not enforced as a single shape here; see the
// Story A/B design notes in Marketing Activity.md), optional free-text venue
// detail, the planned product and invited-participant lists, the Necessity-
// Driven requirement category and the CPN/CPS/Bonjour/Matinee/La Garde
// expected-count fields (both set at creation time, not execution time),
// and the shared/organizer-level event cost (distinct from any delegate's
// own reported expense, which is captured separately on the assignment
// execution schema below).
//
// centerId and territoryId are no longer mutually exclusive: the "where"
// picker for centre-based types (CPN, CPS, Bonjour, Matinee Scientifique,
// La Garde) is a Territory -> Centre cascade that submits both together
// (territoryId narrows the centre list; centerId is the actual selection) —
// not an either/or choice. RTM/CME/Nurse Conference use `location` instead
// and never submit either; Necessity-Driven submits neither.
const activitySharedFields = {
  name: z.string().trim().min(1).max(200),
  typeId: id,
  centerId: id.nullish(),
  territoryId: id.nullish(),
  location: z.string().trim().max(200).nullish(),
  departmentName: z.string().trim().max(200).nullish(),
  speakerContactId: id.nullish(),
  requirementCategoryId: id.nullish(),
  prescriberCount: z.coerce.number().int().min(0).nullish(),
  expectedParticipants: z.coerce.number().int().min(0).nullish(),
  foodExpense: z.coerce.number().min(0).nullish(),
  transportExpense: z.coerce.number().min(0).nullish(),
  notes: z.string().trim().max(2000).nullish(),
  products: z.array(activityProductInput).max(50).default([]),
  participantContactIds: z.array(id).max(200).default([]),
};

export const createActivitySchema = z.object(activitySharedFields);
export type CreateActivityInput = z.infer<typeof createActivitySchema>;

export const updateActivitySchema = z.object({ id, ...activitySharedFields });
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;

// Creates a new, independent assignment — an activity may already have
// other active assignments; this never touches them. Scheduling happens
// here, at assignment time: each assignee gets their own date. The assignee
// must also be within the manager's downstream scope — checked in the
// service, not expressible here.
export const createAssignmentSchema = z.object({
  activityId: id,
  userId: id,
  scheduledDate: z.iso.date(),
});
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

// Reassigning one specific assignment: cancels it and creates a fresh one
// for the new user and date, leaving every other assignment on the same
// activity untouched.
export const reassignAssignmentSchema = z.object({
  assignmentId: id,
  userId: id,
  scheduledDate: z.iso.date(),
});
export type ReassignAssignmentInput = z.infer<typeof reassignAssignmentSchema>;

export const cancelAssignmentSchema = z.object({
  assignmentId: id,
});
export type CancelAssignmentInput = z.infer<typeof cancelAssignmentSchema>;

export const updateAssignmentStatusSchema = z.object({
  assignmentId: id,
  status: activityAssignmentStatus,
});
export type UpdateAssignmentStatusInput = z.infer<typeof updateAssignmentStatusSchema>;

// This delegate's own execution record for one assignment — every field is
// optional at this boundary (the UI only shows the ones relevant to the
// activity's type, driven off ActivityTypeDef.code/category client-side),
// but the server accepts the full superset rather than a discriminated
// union keyed by type for this pass of Story A. Tightening this to a
// per-type-code discriminated union is a reasonable follow-up once the
// per-type conditional UI itself is built out further.
const assignmentParticipantResultInput = z.object({
  contactId: id,
  present: z.boolean(),
  unplanned: z.boolean().default(false),
  feedback: z.string().trim().max(2000).nullish(),
  prescriptionsGenerated: z.coerce.number().int().min(0).nullish(),
});

const assignmentProductResultInput = z.object({
  productId: id,
  unplanned: z.boolean().default(false),
  prescriptionsGenerated: z.coerce.number().int().min(0).nullish(),
  businessValueGenerated: z.coerce.number().min(0).nullish(),
  samplesProvided: z.coerce.number().int().min(0).nullish(),
});

export const updateAssignmentExecutionSchema = z.object({
  assignmentId: id,
  outcomeNotes: z.string().trim().max(2000).nullish(),
  hcpFeedback: z.string().trim().max(2000).nullish(),
  beneficiaryFeedback: z.string().trim().max(2000).nullish(),
  commitments: z.string().trim().max(2000).nullish(),
  pregnantWomenReached: z.coerce.number().int().min(0).nullish(),
  childrenConsulted: z.coerce.number().int().min(0).nullish(),
  actualParticipants: z.coerce.number().int().min(0).nullish(),
  nightShiftTiming: z.string().trim().max(200).nullish(),
  requirementValue: z.coerce.number().min(0).nullish(),
  supportProvidedDescription: z.string().trim().max(2000).nullish(),
  recipientContactId: id.nullish(),
  foodExpense: z.coerce.number().min(0).nullish(),
  transportExpense: z.coerce.number().min(0).nullish(),
  results: z.array(assignmentParticipantResultInput).max(200).default([]),
  productResults: z.array(assignmentProductResultInput).max(50).default([]),
});
export type UpdateAssignmentExecutionInput = z.infer<typeof updateAssignmentExecutionSchema>;

// The Assignment table's filterable statuses — same values as the enum, kept
// as its own export so a filter schema change here doesn't have to reach
// into the Prisma-generated enum.
export const ACTIVITY_ASSIGNMENT_STATUSES = ["PLANNED", "DONE", "CANCELLED"] as const;

const ACTIVITY_TABLE_PAGE_SIZE = 10;

// URL query of the Activity List: search (by name), type, status (any
// assignment on the activity matching) and date range, plus pagination.
// Malformed values fall back to "absent"/page 1, same stance as
// routeListParamsSchema. `typeId` (an ActivityTypeDef id), not a fixed enum
// value — the type list is admin-maintained.
export const activityListParamsSchema = z.object({
  q: z.string().trim().max(200).optional().catch(undefined),
  typeId: id.optional().catch(undefined),
  status: activityAssignmentStatus.optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .catch(ACTIVITY_TABLE_PAGE_SIZE)
    .transform((value) => Math.min(value, MAX_PAGE_SIZE)),
});
export type ActivityListParams = z.infer<typeof activityListParamsSchema>;

// URL query of the Assignment table: same shape, plus an assignee filter —
// one row per assignment, so "assignee" is a direct column here, not a
// relation to filter through.
export const activityAssignmentFiltersSchema = z.object({
  q: z.string().trim().max(200).optional().catch(undefined),
  assigneeId: id.optional().catch(undefined),
  typeId: id.optional().catch(undefined),
  status: activityAssignmentStatus.optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .catch(ACTIVITY_TABLE_PAGE_SIZE)
    .transform((value) => Math.min(value, MAX_PAGE_SIZE)),
});
export type ActivityAssignmentFilters = z.infer<typeof activityAssignmentFiltersSchema>;

// Type-ahead for the Assignment screen's two dropdowns (activities in scope;
// users the actor may assign to). Same bounded-result convention as Routes.
export const ACTIVITY_SEARCH_LIMIT = 20;
const searchText = z.string().trim().max(200).default("");
const searchLimit = z.coerce
  .number()
  .int()
  .min(1)
  .max(ACTIVITY_SEARCH_LIMIT)
  .default(ACTIVITY_SEARCH_LIMIT);

export const activitySearchQuerySchema = z.object({
  q: searchText,
  limit: searchLimit,
});
export type ActivitySearchQuery = z.infer<typeof activitySearchQuerySchema>;

export const activityAssigneeSearchQuerySchema = z.object({
  q: searchText,
  limit: searchLimit,
});
export type ActivityAssigneeSearchQuery = z.infer<typeof activityAssigneeSearchQuerySchema>;
