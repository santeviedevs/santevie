import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

const activityInclude = {
  center: { select: { id: true, name: true, code: true } },
  territory: { select: { id: true, code: true } },
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

const assignmentInclude = {
  activity: {
    select: {
      id: true,
      name: true,
      type: true,
      notes: true,
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

export function createActivityRow(data: Prisma.ActivityCreateInput): Promise<ActivityRow> {
  return prisma.activity.create({ data, include: activityInclude });
}

export function updateActivityRow(
  id: string,
  data: Prisma.ActivityUpdateInput,
): Promise<ActivityRow> {
  return prisma.activity.update({ where: { id }, data, include: activityInclude });
}

export function findActivityById(id: string): Promise<ActivityRow | null> {
  return prisma.activity.findUnique({ where: { id }, include: activityInclude });
}

export function findAssignmentById(id: string): Promise<ActivityAssignmentRow | null> {
  return prisma.activityAssignment.findUnique({ where: { id }, include: assignmentInclude });
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
  type?: string;
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
      query.type ? { type: query.type as Prisma.EnumActivityTypeFilter["equals"] } : {},
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
  type?: string;
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
      query.type
        ? { activity: { type: query.type as Prisma.EnumActivityTypeFilter["equals"] } }
        : {},
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
  type: string;
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
    select: { id: true, name: true, type: true, _count: { select: { assignments: true } } },
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
