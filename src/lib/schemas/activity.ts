import { z } from "zod";

import { MAX_PAGE_SIZE } from "@/lib/pagination";

const id = z.string().min(1);

const activityType = z.enum(["CAMPAIGN", "EVENT", "OTHER"]);
const activityAssignmentStatus = z.enum(["PLANNED", "DONE", "CANCELLED"]);

// Exactly one of centerId/territoryId — Prisma has no native constraint for
// this, so it's enforced here, at the server boundary every input must
// cross.
export const createActivitySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    type: activityType,
    centerId: id.nullish(),
    territoryId: id.nullish(),
    notes: z.string().trim().max(2000).nullish(),
  })
  .superRefine((data, ctx) => {
    const hasCenter = Boolean(data.centerId);
    const hasTerritory = Boolean(data.territoryId);
    if (hasCenter === hasTerritory) {
      ctx.addIssue({
        code: "custom",
        path: ["centerId"],
        message: "Choose exactly one: a center or a territory.",
      });
    }
  });
export type CreateActivityInput = z.infer<typeof createActivitySchema>;

export const updateActivitySchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(200),
    type: activityType,
    centerId: id.nullish(),
    territoryId: id.nullish(),
    notes: z.string().trim().max(2000).nullish(),
  })
  .superRefine((data, ctx) => {
    const hasCenter = Boolean(data.centerId);
    const hasTerritory = Boolean(data.territoryId);
    if (hasCenter === hasTerritory) {
      ctx.addIssue({
        code: "custom",
        path: ["centerId"],
        message: "Choose exactly one: a center or a territory.",
      });
    }
  });
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

// The Assignment table's filterable statuses — same values as the enum, kept
// as its own export so a filter schema change here doesn't have to reach
// into the Prisma-generated enum.
export const ACTIVITY_ASSIGNMENT_STATUSES = ["PLANNED", "DONE", "CANCELLED"] as const;

const ACTIVITY_TABLE_PAGE_SIZE = 10;

// URL query of the Activity List: search (by name), type, status (any
// assignment on the activity matching) and date range, plus pagination.
// Malformed values fall back to "absent"/page 1, same stance as
// routeListParamsSchema.
export const activityListParamsSchema = z.object({
  q: z.string().trim().max(200).optional().catch(undefined),
  type: activityType.optional().catch(undefined),
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
  type: activityType.optional().catch(undefined),
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
