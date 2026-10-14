import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

const activityTypeSelect = {
  id: true,
  code: true,
  name: true,
  category: true,
} satisfies Prisma.ActivityTypeDefSelect;

const requirementCategorySelect = {
  id: true,
  code: true,
  name: true,
} satisfies Prisma.RequirementCategoryDefSelect;

const activityInclude = {
  type: { select: activityTypeSelect },
  center: { select: { id: true, name: true, code: true } },
  territory: { select: { id: true, code: true } },
  speaker: { select: { id: true, name: true } },
  requirementCategory: { select: requirementCategorySelect },
  products: {
    select: {
      id: true,
      availability: true,
      product: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: "asc" },
  },
  participants: {
    select: {
      id: true,
      invited: true,
      contact: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  },
  assignments: {
    select: {
      id: true,
      status: true,
      scheduledDate: true,
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.ActivityInclude;

export type ActivityRow = Prisma.ActivityGetPayload<{ include: typeof activityInclude }>;

// Full execution detail for one assignment — this delegate's own results,
// distinct from the shared Activity-level plan above (see the schema
// comments on ActivityAssignment / AssignmentParticipantResult /
// AssignmentProductResult for the shared-vs-delegate-specific split).
const assignmentExecutionInclude = {
  activity: {
    select: {
      id: true,
      name: true,
      notes: true,
      location: true,
      departmentName: true,
      foodExpense: true,
      transportExpense: true,
      type: { select: activityTypeSelect },
      center: { select: { id: true, name: true, code: true } },
      territory: { select: { id: true, code: true } },
      speaker: { select: { id: true, name: true } },
      requirementCategory: { select: requirementCategorySelect },
      prescriberCount: true,
      expectedParticipants: true,
      products: {
        select: { id: true, availability: true, product: { select: { id: true, name: true } } },
      },
      participants: {
        select: { id: true, invited: true, contact: { select: { id: true, name: true } } },
      },
    },
  },
  user: { select: { id: true, name: true } },
  results: {
    select: {
      id: true,
      contactId: true,
      present: true,
      unplanned: true,
      feedback: true,
      prescriptionsGenerated: true,
      contact: { select: { id: true, name: true } },
    },
  },
  productResults: {
    select: {
      id: true,
      productId: true,
      unplanned: true,
      prescriptionsGenerated: true,
      businessValueGenerated: true,
      samplesProvided: true,
      availability: true,
      product: { select: { id: true, name: true } },
    },
  },
  recipient: { select: { id: true, name: true } },
} satisfies Prisma.ActivityAssignmentInclude;

export type AssignmentExecutionRow = Prisma.ActivityAssignmentGetPayload<{
  include: typeof assignmentExecutionInclude;
}>;

const assignmentInclude = {
  activity: {
    select: {
      id: true,
      name: true,
      notes: true,
      type: { select: activityTypeSelect },
      center: { select: { id: true, name: true, code: true } },
      territory: { select: { id: true, code: true } },
    },
  },
  user: { select: { id: true, name: true } },
} satisfies Prisma.ActivityAssignmentInclude;

export type ActivityAssignmentRow = Prisma.ActivityAssignmentGetPayload<{
  include: typeof assignmentInclude;
}>;

// Either the shared client or an interactive-transaction client — reassigning
// an assignment (cancel + create) has to be atomic, same reasoning as
// route-repository's Db/runInTransaction.
export type Db = Prisma.TransactionClient;

export function runInTransaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}

export function createActivityRow(
  data: Prisma.ActivityCreateInput,
  db: Db = prisma,
): Promise<ActivityRow> {
  return db.activity.create({ data, include: activityInclude });
}

export function updateActivityRow(
  id: string,
  data: Prisma.ActivityUpdateInput,
  db: Db = prisma,
): Promise<ActivityRow> {
  return db.activity.update({ where: { id }, data, include: activityInclude });
}

export function findActivityById(id: string): Promise<ActivityRow | null> {
  return prisma.activity.findUnique({ where: { id }, include: activityInclude });
}

export function findAssignmentById(id: string): Promise<ActivityAssignmentRow | null> {
  return prisma.activityAssignment.findUnique({ where: { id }, include: assignmentInclude });
}

export function findAssignmentExecutionById(id: string): Promise<AssignmentExecutionRow | null> {
  return prisma.activityAssignment.findUnique({
    where: { id },
    include: assignmentExecutionInclude,
  });
}

export function updateAssignmentExecutionRow(
  id: string,
  data: Prisma.ActivityAssignmentUpdateInput,
  db: Db = prisma,
): Promise<AssignmentExecutionRow> {
  return db.activityAssignment.update({
    where: { id },
    data,
    include: assignmentExecutionInclude,
  });
}

// --- Shared-plan child rows (ActivityProduct / ActivityParticipant) --------
// Replace-on-write: the create/update Activity Server Action always sends
// the full intended product/participant list, so the simplest and safest
// implementation is delete-then-recreate inside the same write, rather than
// diffing. Both run inside the caller's transaction when one is supplied.

export async function replaceActivityProducts(
  activityId: string,
  products: { productId: string; availability?: string | null }[],
  actorId: string,
  db: Db = prisma,
): Promise<void> {
  await db.activityProduct.deleteMany({ where: { activityId } });
  if (products.length === 0) return;
  await db.activityProduct.createMany({
    data: products.map((p) => ({
      activityId,
      productId: p.productId,
      availability: p.availability ?? null,
      createdBy: actorId,
      updatedBy: actorId,
    })),
  });
}

export async function replaceActivityParticipants(
  activityId: string,
  contactIds: string[],
  actorId: string,
  db: Db = prisma,
): Promise<void> {
  await db.activityParticipant.deleteMany({ where: { activityId } });
  if (contactIds.length === 0) return;
  await db.activityParticipant.createMany({
    data: contactIds.map((contactId) => ({
      activityId,
      contactId,
      createdBy: actorId,
      updatedBy: actorId,
    })),
  });
}

// --- Assignment execution child rows (results / productResults) ------------
// Same replace-on-write approach as above — the execution form always
// submits the full set of participant/product results for that assignment.

export async function replaceAssignmentParticipantResults(
  assignmentId: string,
  results: {
    contactId: string;
    present: boolean;
    unplanned?: boolean;
    feedback?: string | null;
    prescriptionsGenerated?: number | null;
  }[],
  actorId: string,
  db: Db = prisma,
): Promise<void> {
  await db.assignmentParticipantResult.deleteMany({ where: { assignmentId } });
  if (results.length === 0) return;
  await db.assignmentParticipantResult.createMany({
    data: results.map((r) => ({
      assignmentId,
      contactId: r.contactId,
      present: r.present,
      unplanned: r.unplanned ?? false,
      feedback: r.feedback ?? null,
      prescriptionsGenerated: r.prescriptionsGenerated ?? null,
      createdBy: actorId,
      updatedBy: actorId,
    })),
  });
}

export async function replaceAssignmentProductResults(
  assignmentId: string,
  results: {
    productId: string;
    unplanned?: boolean;
    prescriptionsGenerated?: number | null;
    businessValueGenerated?: number | null;
    samplesProvided?: number | null;
    availability?: string | null;
  }[],
  actorId: string,
  db: Db = prisma,
): Promise<void> {
  await db.assignmentProductResult.deleteMany({ where: { assignmentId } });
  if (results.length === 0) return;
  await db.assignmentProductResult.createMany({
    data: results.map((r) => ({
      assignmentId,
      productId: r.productId,
      unplanned: r.unplanned ?? false,
      prescriptionsGenerated: r.prescriptionsGenerated ?? null,
      businessValueGenerated: r.businessValueGenerated ?? null,
      samplesProvided: r.samplesProvided ?? null,
      availability: r.availability ?? null,
      createdBy: actorId,
      updatedBy: actorId,
    })),
  });
}

// --- Active Type lookup ------------------------------------------------------

export type ActivityTypeDefRow = {
  id: string;
  code: string;
  name: string;
  category: "STANDARD_EVENT" | "PRESCRIPTION_TRACKING" | "EMBALLAGE";
};

// Only STANDARD_EVENT types are ever selectable on an Activity — Prescription
// and Emballage are structurally separate (Story C/D), never an Activity row.
export function listStandardEventActivityTypes(): Promise<ActivityTypeDefRow[]> {
  return prisma.activityTypeDef.findMany({
    where: { category: "STANDARD_EVENT", status: "ACTIVE" },
    select: activityTypeSelect,
    orderBy: { name: "asc" },
  });
}

export function findActivityTypeById(id: string): Promise<ActivityTypeDefRow | null> {
  return prisma.activityTypeDef.findUnique({ where: { id }, select: activityTypeSelect });
}

export type RequirementCategoryRow = { id: string; code: string; name: string };

export function listRequirementCategories(): Promise<RequirementCategoryRow[]> {
  return prisma.requirementCategoryDef.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });
}

// An activity may have more than one PLANNED assignment for different
// users, but never two for the *same* user at once — this is the app-level
// guard createAssignment checks before inserting (deliberately not a DB
// unique constraint: a cancelled-then-reassigned pair for the same user is
// fine, only a second concurrently-active one is not).
export function findActivePlannedAssignment(
  activityId: string,
  userId: string,
): Promise<{ id: string } | null> {
  return prisma.activityAssignment.findFirst({
    where: { activityId, userId, status: "PLANNED" },
    select: { id: true },
  });
}

export function createAssignmentRow(
  activityId: string,
  userId: string,
  scheduledDate: Date,
  actorId: string,
  db: Db = prisma,
): Promise<ActivityAssignmentRow> {
  return db.activityAssignment.create({
    data: {
      activity: { connect: { id: activityId } },
      user: { connect: { id: userId } },
      scheduledDate,
      createdBy: actorId,
      updatedBy: actorId,
    },
    include: assignmentInclude,
  });
}

export function updateAssignmentStatusRow(
  id: string,
  status: Prisma.ActivityAssignmentUpdateInput["status"],
  actorId: string,
  db: Db = prisma,
): Promise<ActivityAssignmentRow> {
  return db.activityAssignment.update({
    where: { id },
    data: { status, updatedBy: actorId },
    include: assignmentInclude,
  });
}

// Just enough to decide what auto-follow-up(s) a completed assignment
// should get — the type's chain config, and (for the per-participant fan-
// out) which invited participants this delegate actually marked present.
// Read inside the same transaction as the status write (see
// activity-service's updateAssignmentStatus) so the decision is made from
// the same snapshot that gets committed.
const assignmentCompletionSelect = {
  id: true,
  userId: true,
  activity: {
    select: {
      type: {
        select: {
          defaultFollowUpInitialOffsetDays: true,
          defaultFollowUpRecurrenceIntervalDays: true,
          defaultFollowUpSeriesDurationDays: true,
          defaultFollowUpPerParticipant: true,
        },
      },
    },
  },
  results: { select: { id: true, present: true } },
} satisfies Prisma.ActivityAssignmentSelect;

export type AssignmentCompletionContext = Prisma.ActivityAssignmentGetPayload<{
  select: typeof assignmentCompletionSelect;
}>;

export function findAssignmentCompletionContext(
  id: string,
  db: Db = prisma,
): Promise<AssignmentCompletionContext | null> {
  return db.activityAssignment.findUnique({ where: { id }, select: assignmentCompletionSelect });
}

export type ActivityQuery = {
  // `undefined` means unrestricted (ADMIN) — same convention as
  // scopeUserIds in scope.ts. An activity is visible if any of its
  // assignments belongs to one of these users.
  assignedScopeUserIds: string[] | undefined;
  // Additionally returns activities with no assignment at all yet, but only
  // ones created by one of these users — an unassigned activity has no
  // assignee to scope on, so the creator stands in for it.
  unassignedCreatorIds?: string[];
  q?: string;
  typeId?: string;
  // Matches activities with at least one assignment in this status.
  status?: string;
  assigneeId?: string;
  from?: Date;
  to?: Date;
  skip?: number;
  take?: number;
};

function buildActivityWhere(query: ActivityQuery): Prisma.ActivityWhereInput {
  const { assignedScopeUserIds, unassignedCreatorIds } = query;

  const visibility: Prisma.ActivityWhereInput = !assignedScopeUserIds
    ? {}
    : unassignedCreatorIds
      ? {
          OR: [
            { assignments: { some: { userId: { in: assignedScopeUserIds } } } },
            { assignments: { none: {} }, createdBy: { in: unassignedCreatorIds } },
          ],
        }
      : { assignments: { some: { userId: { in: assignedScopeUserIds } } } };

  return {
    AND: [
      visibility,
      query.q ? { name: { contains: query.q, mode: "insensitive" } } : {},
      query.typeId ? { typeId: query.typeId } : {},
      query.status
        ? {
            assignments: {
              some: { status: query.status as Prisma.EnumActivityAssignmentStatusFilter["equals"] },
            },
          }
        : {},
      query.assigneeId ? { assignments: { some: { userId: query.assigneeId } } } : {},
      query.from || query.to
        ? { assignments: { some: { scheduledDate: { gte: query.from, lt: query.to } } } }
        : {},
    ],
  };
}

export function listActivities(query: ActivityQuery): Promise<ActivityRow[]> {
  return prisma.activity.findMany({
    where: buildActivityWhere(query),
    include: activityInclude,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: query.skip,
    take: query.take,
  });
}

export function countActivities(query: ActivityQuery): Promise<number> {
  return prisma.activity.count({ where: buildActivityWhere(query) });
}

export type ActivityAssignmentQuery = {
  // `undefined` means unrestricted (ADMIN).
  scopeUserIds: string[] | undefined;
  q?: string;
  typeId?: string;
  status?: string;
  assigneeId?: string;
  from?: Date;
  to?: Date;
  skip?: number;
  take?: number;
};

function buildAssignmentWhere(query: ActivityAssignmentQuery): Prisma.ActivityAssignmentWhereInput {
  return {
    AND: [
      query.scopeUserIds ? { userId: { in: query.scopeUserIds } } : {},
      query.assigneeId ? { userId: query.assigneeId } : {},
      query.status
        ? { status: query.status as Prisma.EnumActivityAssignmentStatusFilter["equals"] }
        : {},
      query.typeId ? { activity: { typeId: query.typeId } } : {},
      query.q ? { activity: { name: { contains: query.q, mode: "insensitive" } } } : {},
      query.from || query.to ? { scheduledDate: { gte: query.from, lt: query.to } } : {},
    ],
  };
}

export function listAssignments(query: ActivityAssignmentQuery): Promise<ActivityAssignmentRow[]> {
  return prisma.activityAssignment.findMany({
    where: buildAssignmentWhere(query),
    include: assignmentInclude,
    orderBy: [{ scheduledDate: "desc" }, { id: "asc" }],
    skip: query.skip,
    take: query.take,
  });
}

export function countAssignments(query: ActivityAssignmentQuery): Promise<number> {
  return prisma.activityAssignment.count({ where: buildAssignmentWhere(query) });
}

// --- Type-ahead search ------------------------------------------------------

export type ActivitySearchResult = {
  id: string;
  name: string;
  type: { id: string; code: string; name: string };
  assignmentCount: number;
};

// Activities within the actor's scope, matched on name — offered on the
// Assignment screen's "Activity" field. Deliberately not narrowed to
// "unassigned only": an activity may already carry other active
// assignments, and that's fine, since more than one person can be assigned
// to it at once. The service re-validates on submit (no duplicate active
// assignment for the same user) regardless of what this returns.
export async function searchActivities(params: {
  scopeUserIds: string[] | undefined;
  unassignedCreatorIds: string[] | undefined;
  q: string;
  limit: number;
}): Promise<ActivitySearchResult[]> {
  const where = buildActivityWhere({
    assignedScopeUserIds: params.scopeUserIds,
    unassignedCreatorIds: params.unassignedCreatorIds,
    q: params.q || undefined,
  });
  const rows = await prisma.activity.findMany({
    where,
    select: {
      id: true,
      name: true,
      type: { select: { id: true, code: true, name: true } },
      _count: { select: { assignments: true } },
    },
    orderBy: { createdAt: "desc" },
    take: params.limit,
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    assignmentCount: row._count.assignments,
  }));
}
