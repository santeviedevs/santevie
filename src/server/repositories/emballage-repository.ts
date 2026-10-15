import { prisma } from "@/server/db";

import { Prisma } from "../../../generated/prisma/client";

// Either the shared client or an interactive-transaction client —
// correcting a row and finalizing a report both have to write their main
// row and an audit row atomically. Same local-alias convention as
// activity-repository.ts/follow-up-repository.ts.
export type Db = Prisma.TransactionClient;

export function runInTransaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}

const listInclude = {
  center: { select: { id: true, name: true, code: true } },
  product: { select: { id: true, name: true, code: true } },
  user: { select: { id: true, name: true } },
} satisfies Prisma.EmballageCollectionInclude;

export type EmballageCollectionRow = Prisma.EmballageCollectionGetPayload<{
  include: typeof listInclude;
}>;

export function createEmballageCollectionRow(
  data: Prisma.EmballageCollectionCreateInput,
  db: Db = prisma,
): Promise<EmballageCollectionRow> {
  return db.emballageCollection.create({ data, include: listInclude });
}

export function findEmballageCollectionById(
  id: string,
  db: Db = prisma,
): Promise<EmballageCollectionRow | null> {
  return db.emballageCollection.findUnique({ where: { id }, include: listInclude });
}

export function correctEmballageCollectionRow(
  id: string,
  newQuantity: Prisma.Decimal | string,
  actorId: string,
  db: Db = prisma,
): Promise<EmballageCollectionRow> {
  return db.emballageCollection.update({
    where: { id },
    data: {
      quantity: newQuantity,
      correctionCount: { increment: 1 },
      updatedBy: actorId,
    },
    include: listInclude,
  });
}

export function createEmballageCorrectionRow(
  data: Prisma.EmballageCorrectionCreateInput,
  db: Db = prisma,
): Promise<{ id: string }> {
  return db.emballageCorrection.create({ data, select: { id: true } });
}

export type EmballageCorrectionRow = Prisma.EmballageCorrectionGetPayload<{
  include: { correctedByUser: { select: { id: true; name: true } } };
}>;

export function findCorrectionsForCollection(
  collectionId: string,
): Promise<EmballageCorrectionRow[]> {
  return prisma.emballageCorrection.findMany({
    where: { collectionId },
    include: { correctedByUser: { select: { id: true, name: true } } },
    orderBy: { correctedAt: "asc" },
  });
}

export type EmballageQuery = {
  // `undefined` means unrestricted (ADMIN) — same convention as
  // scopeUserIds in scope.ts. "My Collections" passes `[userId]`.
  userScopeUserIds: string[] | undefined;
  centerId?: string;
  productId?: string;
  from?: Date;
  to?: Date;
  skip?: number;
  take?: number;
};

function buildEmballageWhere(query: EmballageQuery): Prisma.EmballageCollectionWhereInput {
  return {
    AND: [
      query.userScopeUserIds ? { userId: { in: query.userScopeUserIds } } : {},
      query.centerId ? { centerId: query.centerId } : {},
      query.productId ? { productId: query.productId } : {},
      query.from || query.to ? { visitDate: { gte: query.from, lt: query.to } } : {},
    ],
  };
}

export function listEmballageCollections(query: EmballageQuery): Promise<EmballageCollectionRow[]> {
  return prisma.emballageCollection.findMany({
    where: buildEmballageWhere(query),
    include: listInclude,
    orderBy: [{ visitDate: "desc" }, { id: "asc" }],
    skip: query.skip,
    take: query.take,
  });
}

export function countEmballageCollections(query: EmballageQuery): Promise<number> {
  return prisma.emballageCollection.count({ where: buildEmballageWhere(query) });
}

// Every collection row in one calendar month, with the centre/product names
// the report and export need — the service layer sums `quantity` (always
// the *current*, corrected value) in memory rather than via SQL GROUP BY,
// so centre/product names come along for free without a second lookup.
// Report-month volumes are small enough for this not to matter.
export function findEmballageCollectionsForPeriod(
  periodMonth: number,
  periodYear: number,
  centerId?: string,
  productId?: string,
): Promise<EmballageCollectionRow[]> {
  const start = new Date(Date.UTC(periodYear, periodMonth - 1, 1));
  const end = new Date(Date.UTC(periodYear, periodMonth, 1));
  return prisma.emballageCollection.findMany({
    where: {
      visitDate: { gte: start, lt: end },
      ...(centerId ? { centerId } : {}),
      ...(productId ? { productId } : {}),
    },
    include: listInclude,
    orderBy: [{ centerId: "asc" }, { productId: "asc" }],
  });
}

export function lockEmballageCollectionsForPeriod(
  periodMonth: number,
  periodYear: number,
  db: Db,
): Promise<Prisma.BatchPayload> {
  const start = new Date(Date.UTC(periodYear, periodMonth - 1, 1));
  const end = new Date(Date.UTC(periodYear, periodMonth, 1));
  return db.emballageCollection.updateMany({
    where: { visitDate: { gte: start, lt: end } },
    data: { locked: true },
  });
}

export function createEmballageReportRunRow(
  data: Prisma.EmballageReportRunCreateInput,
  db: Db = prisma,
) {
  return db.emballageReportRun.create({ data });
}

export function findEmballageReportRun(periodMonth: number, periodYear: number) {
  return prisma.emballageReportRun.findUnique({
    where: { periodMonth_periodYear: { periodMonth, periodYear } },
  });
}
