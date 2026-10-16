import { prisma } from "@/server/db";

import { Prisma } from "../../../generated/prisma/client";

// Either the shared client or an interactive-transaction client — recording
// an update locks the target row (the sequence increment) and inserts the
// update row atomically. Same local-alias convention as
// activity-repository.ts/emballage-repository.ts.
export type Db = Prisma.TransactionClient;

export function runInTransaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}

const targetInclude = {
  contact: { select: { id: true, name: true } },
  product: { select: { id: true, name: true, code: true } },
  user: { select: { id: true, name: true } },
} satisfies Prisma.PrescriptionTargetInclude;

export type PrescriptionTargetRow = Prisma.PrescriptionTargetGetPayload<{
  include: typeof targetInclude;
}>;

export function createPrescriptionTargetRow(
  data: Prisma.PrescriptionTargetCreateInput,
  db: Db = prisma,
): Promise<PrescriptionTargetRow> {
  return db.prescriptionTarget.create({ data, include: targetInclude });
}

export function findPrescriptionTargetById(
  id: string,
  db: Db = prisma,
): Promise<PrescriptionTargetRow | null> {
  return db.prescriptionTarget.findUnique({ where: { id }, include: targetInclude });
}

export function findPrescriptionTargetByUniqueKey(
  contactId: string,
  productId: string,
  userId: string,
  periodMonth: number,
  periodYear: number,
  db: Db = prisma,
): Promise<PrescriptionTargetRow | null> {
  return db.prescriptionTarget.findUnique({
    where: {
      contactId_productId_userId_periodMonth_periodYear: {
        contactId,
        productId,
        userId,
        periodMonth,
        periodYear,
      },
    },
    include: targetInclude,
  });
}

export function updatePrescriptionTargetRow(
  id: string,
  monthlyTarget: number,
  actorId: string,
  db: Db,
): Promise<PrescriptionTargetRow> {
  return db.prescriptionTarget.update({
    where: { id },
    data: { monthlyTarget, updatedBy: actorId },
    include: targetInclude,
  });
}

export function createPrescriptionTargetRevisionRow(
  data: Prisma.PrescriptionTargetRevisionCreateInput,
  db: Db,
) {
  return db.prescriptionTargetRevision.create({ data });
}

export type PrescriptionTargetRevisionRow = Prisma.PrescriptionTargetRevisionGetPayload<{
  include: { changedByUser: { select: { id: true; name: true } } };
}>;

export function findRevisionsForTarget(targetId: string): Promise<PrescriptionTargetRevisionRow[]> {
  return prisma.prescriptionTargetRevision.findMany({
    where: { targetId },
    include: { changedByUser: { select: { id: true, name: true } } },
    orderBy: { changedAt: "asc" },
  });
}

// The lock: an UPDATE (not a SELECT) is what takes the row-level lock on
// the target, serializing concurrent submissions. Must run inside the same
// transaction as the latest-value read that follows it and the
// PrescriptionUpdate insert that follows that — see
// prescription-service.ts's recordPrescriptionUpdate for the full sequence.
export async function incrementUpdateSequence(targetId: string, db: Db): Promise<number> {
  const row = await db.prescriptionTarget.update({
    where: { id: targetId },
    data: { updateSequence: { increment: 1 } },
    select: { updateSequence: true },
  });
  return row.updateSequence;
}

const updateInclude = {
  recordedByUser: { select: { id: true, name: true } },
} satisfies Prisma.PrescriptionUpdateInclude;

export type PrescriptionUpdateRow = Prisma.PrescriptionUpdateGetPayload<{
  include: typeof updateInclude;
}>;

// Must be called after incrementUpdateSequence within the same transaction
// — reading "latest" before the lock is taken would let two concurrent
// submissions both read the same stale value.
export function findLatestUpdateForTarget(
  targetId: string,
  db: Db,
): Promise<PrescriptionUpdateRow | null> {
  return db.prescriptionUpdate.findFirst({
    where: { targetId },
    include: updateInclude,
    orderBy: { sequenceNo: "desc" },
  });
}

export function createPrescriptionUpdateRow(
  data: Prisma.PrescriptionUpdateCreateInput,
  db: Db,
): Promise<PrescriptionUpdateRow> {
  return db.prescriptionUpdate.create({ data, include: updateInclude });
}

export function listUpdatesForTarget(targetId: string): Promise<PrescriptionUpdateRow[]> {
  return prisma.prescriptionUpdate.findMany({
    where: { targetId },
    include: updateInclude,
    orderBy: { sequenceNo: "desc" },
  });
}

export type PrescriptionTargetQuery = {
  // `undefined` means unrestricted (ADMIN) — same convention as
  // scopeUserIds in scope.ts / EmballageQuery.userScopeUserIds.
  userScopeUserIds: string[] | undefined;
  contactId?: string;
  productId?: string;
  periodMonth?: number;
  periodYear?: number;
  skip?: number;
  take?: number;
};

function buildPrescriptionTargetWhere(
  query: PrescriptionTargetQuery,
): Prisma.PrescriptionTargetWhereInput {
  return {
    AND: [
      query.userScopeUserIds ? { userId: { in: query.userScopeUserIds } } : {},
      query.contactId ? { contactId: query.contactId } : {},
      query.productId ? { productId: query.productId } : {},
      query.periodMonth ? { periodMonth: query.periodMonth } : {},
      query.periodYear ? { periodYear: query.periodYear } : {},
    ],
  };
}

export function listPrescriptionTargets(
  query: PrescriptionTargetQuery,
): Promise<PrescriptionTargetRow[]> {
  return prisma.prescriptionTarget.findMany({
    where: buildPrescriptionTargetWhere(query),
    include: targetInclude,
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }, { id: "asc" }],
    skip: query.skip,
    take: query.take,
  });
}

export function countPrescriptionTargets(query: PrescriptionTargetQuery): Promise<number> {
  return prisma.prescriptionTarget.count({ where: buildPrescriptionTargetWhere(query) });
}

// The single latest PrescriptionUpdate row (by sequenceNo) for each of the
// given targets — used to enrich a target list with Achieved/Remaining
// without an N+1 query per row. Callers already hold the target rows (with
// contact/product) from listPrescriptionTargets, so no include is needed
// here.
export function findLatestUpdatesForTargetIds(
  targetIds: string[],
): Promise<Prisma.PrescriptionUpdateGetPayload<Record<string, never>>[]> {
  if (targetIds.length === 0) return Promise.resolve([]);
  return prisma.prescriptionUpdate.findMany({
    where: { targetId: { in: targetIds } },
    orderBy: [{ targetId: "asc" }, { sequenceNo: "desc" }],
    distinct: ["targetId"],
  });
}

// For every target a user owns, the single latest PrescriptionUpdate row
// (by sequenceNo, not recordedAt) — used by the Home screen to derive
// "pending prescription follow-ups". Filtering on followUpDate happens in
// the service layer, *after* picking the latest row per target, not here —
// filtering before distinct could surface a stale follow-up date from an
// older update that a newer, dateless update already superseded.
export function findLatestUpdatesForUserTargets(userId: string): Promise<
  Prisma.PrescriptionUpdateGetPayload<{
    include: {
      target: {
        include: {
          contact: { select: { id: true; name: true } };
          product: { select: { id: true; name: true } };
        };
      };
    };
  }>[]
> {
  return prisma.prescriptionUpdate.findMany({
    where: { target: { userId } },
    include: {
      target: {
        include: {
          contact: { select: { id: true, name: true } },
          product: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ targetId: "asc" }, { sequenceNo: "desc" }],
    distinct: ["targetId"],
  });
}
