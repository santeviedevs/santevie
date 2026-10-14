import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

// Either the shared client or an interactive-transaction client — chain
// creation/advancement has to be atomic with the write that triggers it
// (assignment completion, or a prior follow-up's own completion). Same
// local-alias convention as activity-repository.ts/route-repository.ts.
export type Db = Prisma.TransactionClient;

export function runInTransaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}

const listInclude = {
  assignment: {
    select: {
      id: true,
      userId: true,
      scheduledDate: true,
      activity: {
        select: {
          id: true,
          name: true,
          location: true,
          type: { select: { id: true, code: true, name: true } },
          center: { select: { id: true, name: true } },
          territory: { select: { id: true, code: true } },
        },
      },
    },
  },
  owner: { select: { id: true, name: true } },
  participantResult: {
    select: { id: true, contact: { select: { id: true, name: true } } },
  },
} satisfies Prisma.FollowUpInclude;

export type FollowUpRow = Prisma.FollowUpGetPayload<{ include: typeof listInclude }>;

export function createFollowUpRow(
  data: Prisma.FollowUpCreateInput,
  db: Db = prisma,
): Promise<FollowUpRow> {
  return db.followUp.create({ data, include: listInclude });
}

export function findFollowUpById(id: string, db: Db = prisma): Promise<FollowUpRow | null> {
  return db.followUp.findUnique({ where: { id }, include: listInclude });
}

export type CompleteFollowUpData = {
  outcome?: string | null;
  prescriptionsGenerated?: number | null;
  businessValueGenerated?: Prisma.Decimal | string | null;
  productAvailable?: boolean | null;
};

export function completeFollowUpRow(
  id: string,
  actorId: string,
  data: CompleteFollowUpData,
  db: Db = prisma,
): Promise<FollowUpRow> {
  return db.followUp.update({
    where: { id },
    data: {
      status: "DONE",
      outcome: data.outcome ?? null,
      prescriptionsGenerated: data.prescriptionsGenerated ?? null,
      businessValueGenerated: data.businessValueGenerated ?? null,
      productAvailable: data.productAvailable ?? null,
      updatedBy: actorId,
    },
    include: listInclude,
  });
}

export function updateFollowUpOwnerRow(
  id: string,
  newOwnerId: string,
  actorId: string,
  db: Db = prisma,
): Promise<FollowUpRow> {
  return db.followUp.update({
    where: { id },
    data: { owner: { connect: { id: newOwnerId } }, updatedBy: actorId },
    include: listInclude,
  });
}

export function createFollowUpReassignmentRow(
  data: Prisma.FollowUpReassignmentCreateInput,
  db: Db = prisma,
): Promise<{ id: string }> {
  return db.followUpReassignment.create({ data, select: { id: true } });
}

export type FollowUpReassignmentRow = Prisma.FollowUpReassignmentGetPayload<{
  include: {
    previousOwner: { select: { id: true; name: true } };
    newOwner: { select: { id: true; name: true } };
    reassignedByUser: { select: { id: true; name: true } };
  };
}>;

export function findReassignmentsForFollowUp(
  followUpId: string,
): Promise<FollowUpReassignmentRow[]> {
  return prisma.followUpReassignment.findMany({
    where: { followUpId },
    include: {
      previousOwner: { select: { id: true, name: true } },
      newOwner: { select: { id: true, name: true } },
      reassignedByUser: { select: { id: true, name: true } },
    },
    orderBy: { reassignedAt: "asc" },
  });
}

// Every PENDING follow-up owned by this one user, regardless of due date —
// the caller (follow-up-service.ts) splits this into "pending" vs
// "overdue" relative to the business date it's asked about. Owner-scoped,
// not assignee-scoped: once a follow-up is reassigned, it belongs to its
// new owner's list, not the original assignee's.
export function findPendingFollowUpsForUser(userId: string): Promise<FollowUpRow[]> {
  return prisma.followUp.findMany({
    where: { status: "PENDING", ownerId: userId },
    include: listInclude,
    orderBy: { dueDate: "asc" },
  });
}

// `userIds: undefined` means unrestricted (ADMIN).
export function findPendingFollowUps(userIds: string[] | undefined): Promise<FollowUpRow[]> {
  return prisma.followUp.findMany({
    where: {
      status: "PENDING",
      ...(userIds ? { ownerId: { in: userIds } } : {}),
    },
    include: listInclude,
    orderBy: { dueDate: "asc" },
  });
}

// The filtered, paginated My/Team Follow-Ups tables — same query/where
// shape as activity-repository.ts's ActivityQuery/buildActivityWhere.
// Unlike findPendingFollowUps* below (PENDING-only, used by the compact
// Home widget), this includes DONE rows by default so the table also
// serves as the completed-follow-up history — `status` narrows it.
export type FollowUpQuery = {
  // `undefined` means unrestricted (ADMIN) — same convention as
  // scopeUserIds in scope.ts. "My Follow-Ups" passes `[userId]`.
  ownerScopeUserIds: string[] | undefined;
  q?: string;
  typeId?: string;
  // undefined = every status (the default, so history stays visible).
  status?: "PENDING" | "DONE";
  // Inherently a PENDING concept — a DONE follow-up isn't "overdue" in any
  // actionable sense, so this overrides an explicit `status` filter rather
  // than combining with it.
  overdueOnly?: boolean;
  asOf?: Date;
  from?: Date;
  to?: Date;
  skip?: number;
  take?: number;
};

function buildFollowUpWhere(query: FollowUpQuery): Prisma.FollowUpWhereInput {
  return {
    AND: [
      query.overdueOnly
        ? { status: "PENDING", dueDate: { lt: query.asOf ?? new Date() } }
        : query.status
          ? { status: query.status }
          : {},
      query.ownerScopeUserIds ? { ownerId: { in: query.ownerScopeUserIds } } : {},
      query.q
        ? { assignment: { activity: { name: { contains: query.q, mode: "insensitive" } } } }
        : {},
      query.typeId ? { assignment: { activity: { typeId: query.typeId } } } : {},
      query.from || query.to ? { dueDate: { gte: query.from, lt: query.to } } : {},
    ],
  };
}

export function listFollowUps(query: FollowUpQuery): Promise<FollowUpRow[]> {
  return prisma.followUp.findMany({
    where: buildFollowUpWhere(query),
    include: listInclude,
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
    skip: query.skip,
    take: query.take,
  });
}

export function countFollowUps(query: FollowUpQuery): Promise<number> {
  return prisma.followUp.count({ where: buildFollowUpWhere(query) });
}
