import { type PagedResult, type PaginationParams, toSkipTake } from "@/lib/pagination";
import type {
  CorrectEmballageCollectionInput,
  CreateEmballageCollectionInput,
  FinalizeEmballageReportInput,
} from "@/lib/schemas/emballage";
import {
  correctEmballageCollectionRow,
  countEmballageCollections,
  createEmballageCollectionRow,
  createEmballageCorrectionRow,
  createEmballageReportRunRow,
  type EmballageCollectionRow,
  type EmballageCorrectionRow,
  findCorrectionsForCollection,
  findEmballageCollectionById,
  findEmballageCollectionsForPeriod,
  findEmballageReportRun,
  listEmballageCollections,
  lockEmballageCollectionsForPeriod,
  runInTransaction,
} from "@/server/repositories/emballage-repository";
import { getUserScope, isWithinScope, type ScopeSession, scopeUserIds } from "@/server/scope";

import { Prisma } from "../../../generated/prisma/client";

export class EmballageCollectionNotFoundError extends Error {
  constructor() {
    super("Collection record not found.");
    this.name = "EmballageCollectionNotFoundError";
  }
}

export class EmballageNotAuthorizedError extends Error {
  constructor() {
    super("You can only correct your own collection records.");
    this.name = "EmballageNotAuthorizedError";
  }
}

// Thrown when a non-elevated user (emballage:record-own only, not
// emballage:correct-locked) tries to correct a row already covered by a
// finalized EOM report.
export class EmballageCollectionLockedError extends Error {
  constructor() {
    super("This record is part of a finalized report and can only be corrected by a manager.");
    this.name = "EmballageCollectionLockedError";
  }
}

export class EmballageReportAlreadyFinalizedError extends Error {
  constructor() {
    super("This month's report has already been finalized.");
    this.name = "EmballageReportAlreadyFinalizedError";
  }
}

export type EmballageCollectionSummary = {
  id: string;
  visitDate: Date;
  quantity: string;
  remarks: string | null;
  correctionCount: number;
  locked: boolean;
  center: { id: string; name: string; code: string };
  product: { id: string; name: string; code: string };
  user: { id: string; name: string };
};

export type EmballageCorrectionSummary = {
  id: string;
  previousQuantity: string;
  newQuantity: string;
  reason: string | null;
  correctedBy: { id: string; name: string };
  correctedAt: Date;
};

function toSummary(row: EmballageCollectionRow): EmballageCollectionSummary {
  return {
    id: row.id,
    visitDate: row.visitDate,
    quantity: row.quantity.toString(),
    remarks: row.remarks,
    correctionCount: row.correctionCount,
    locked: row.locked,
    center: row.center,
    product: row.product,
    user: row.user,
  };
}

function toCorrectionSummary(row: EmballageCorrectionRow): EmballageCorrectionSummary {
  return {
    id: row.id,
    previousQuantity: row.previousQuantity.toString(),
    newQuantity: row.newQuantity.toString(),
    reason: row.reason,
    correctedBy: row.correctedByUser,
    correctedAt: row.correctedAt,
  };
}

// A delegate logging their own collection — no assignment/status/
// follow-up machinery, just an append-only row. The same centre/product/
// date combination can be logged again across separate visits; each is its
// own row, never merged or upserted.
export async function createEmballageCollection(
  input: CreateEmballageCollectionInput,
  actorId: string,
): Promise<EmballageCollectionSummary> {
  const created = await createEmballageCollectionRow({
    center: { connect: { id: input.centerId } },
    product: { connect: { id: input.productId } },
    user: { connect: { id: actorId } },
    visitDate: new Date(input.visitDate),
    quantity: input.quantity.toString(),
    remarks: input.remarks ?? null,
    createdBy: actorId,
    updatedBy: actorId,
  });
  return toSummary(created);
}

// Corrects a collection's quantity in place (never a negative offset row)
// and writes one EmballageCorrection audit row in the same transaction.
// Unlocked rows: the owning delegate corrects their own via
// emballage:record-own. Locked rows (already covered by a finalized EOM
// report): only emballage:correct-locked (passed in as `canCorrectLocked`,
// resolved from the session's permissions by the caller) may proceed.
export async function correctEmballageCollection(
  input: CorrectEmballageCollectionInput,
  session: ScopeSession,
  canCorrectLocked: boolean,
): Promise<EmballageCollectionSummary> {
  const existing = await findEmballageCollectionById(input.id);
  if (!existing) throw new EmballageCollectionNotFoundError();

  if (existing.locked) {
    if (!canCorrectLocked) throw new EmballageCollectionLockedError();
  } else if (existing.userId !== session.user.id) {
    throw new EmballageNotAuthorizedError();
  }

  const updated = await runInTransaction(async (tx) => {
    const row = await correctEmballageCollectionRow(
      input.id,
      input.quantity.toString(),
      session.user.id,
      tx,
    );
    await createEmballageCorrectionRow(
      {
        collection: { connect: { id: input.id } },
        previousQuantity: existing.quantity,
        newQuantity: input.quantity.toString(),
        reason: input.reason ?? null,
        correctedByUser: { connect: { id: session.user.id } },
      },
      tx,
    );
    return row;
  });
  return toSummary(updated);
}

export async function getEmballageCollectionDetail(
  id: string,
  session: ScopeSession,
  canViewTeam: boolean,
): Promise<{
  collection: EmballageCollectionSummary;
  corrections: EmballageCorrectionSummary[];
} | null> {
  const row = await findEmballageCollectionById(id);
  if (!row) return null;

  if (row.userId !== session.user.id) {
    if (!canViewTeam) return null;
    const scope = await getUserScope(session);
    if (!isWithinScope(scope, row.userId)) return null;
  }

  const corrections = await findCorrectionsForCollection(id);
  return { collection: toSummary(row), corrections: corrections.map(toCorrectionSummary) };
}

export type EmballageListFilters = {
  centerId?: string;
  productId?: string;
  from?: string;
  to?: string;
};

function toQueryFilters(filters: EmballageListFilters) {
  return {
    centerId: filters.centerId,
    productId: filters.productId,
    from: filters.from ? new Date(filters.from) : undefined,
    // `to` is a calendar date from the date picker — extended to the end of
    // that day so a collection logged that same day is included, same
    // convention as the follow-up list's date-range handling.
    to: filters.to ? new Date(`${filters.to}T23:59:59.999Z`) : undefined,
  };
}

export async function getMyEmballageCollectionsPage(
  userId: string,
  pagination: PaginationParams,
  filters: EmballageListFilters = {},
): Promise<PagedResult<EmballageCollectionSummary>> {
  const query = {
    userScopeUserIds: [userId],
    ...toQueryFilters(filters),
    ...toSkipTake(pagination),
  };
  const [rows, total] = await Promise.all([
    listEmballageCollections(query),
    countEmballageCollections(query),
  ]);
  return {
    items: rows.map(toSummary),
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
}

export async function getTeamEmballageCollectionsPage(
  session: ScopeSession,
  pagination: PaginationParams,
  filters: EmballageListFilters = {},
): Promise<PagedResult<EmballageCollectionSummary>> {
  const scope = await getUserScope(session);
  const query = {
    userScopeUserIds: scopeUserIds(scope),
    ...toQueryFilters(filters),
    ...toSkipTake(pagination),
  };
  const [rows, total] = await Promise.all([
    listEmballageCollections(query),
    countEmballageCollections(query),
  ]);
  return {
    items: rows.map(toSummary),
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
}

export type EmballageReportLine = {
  centerId: string;
  centerName: string;
  productId: string;
  productName: string;
  totalQuantity: string;
  collectionCount: number;
};

// EOM centre-wise x product-wise total quantity, for verification against
// what was physically collected. Always reads the *current* (corrected)
// quantity directly from each row — no separate "use the corrected value"
// branch needed, since EmballageCollection.quantity already holds it.
// Summed in memory rather than via SQL GROUP BY so centre/product names
// come along with the rows already fetched, with no second lookup —
// report-month volumes are small enough for this not to matter.
export async function getEmballageReport(
  periodMonth: number,
  periodYear: number,
  centerId?: string,
  productId?: string,
): Promise<EmballageReportLine[]> {
  const rows = await findEmballageCollectionsForPeriod(
    periodMonth,
    periodYear,
    centerId,
    productId,
  );

  // Decimal arithmetic throughout, never a JavaScript number — quantities
  // are stored as Prisma Decimal specifically so summing them can't
  // silently lose precision (AGENTS.md's Decimal-handling rule applies to
  // quantities, not just money).
  const totals = new Map<
    string,
    {
      centerId: string;
      centerName: string;
      productId: string;
      productName: string;
      total: Prisma.Decimal;
      count: number;
    }
  >();
  for (const row of rows) {
    const key = `${row.centerId}:${row.productId}`;
    const existing = totals.get(key);
    if (existing) {
      existing.total = existing.total.plus(row.quantity);
      existing.count += 1;
    } else {
      totals.set(key, {
        centerId: row.centerId,
        centerName: row.center.name,
        productId: row.productId,
        productName: row.product.name,
        total: row.quantity,
        count: 1,
      });
    }
  }

  return [...totals.values()]
    .sort(
      (a, b) =>
        a.centerName.localeCompare(b.centerName) || a.productName.localeCompare(b.productName),
    )
    .map((entry) => ({
      centerId: entry.centerId,
      centerName: entry.centerName,
      productId: entry.productId,
      productName: entry.productName,
      totalQuantity: entry.total.toString(),
      collectionCount: entry.count,
    }));
}

// Finalizing is manager-level (emballage:finalize-report): bulk-locks every
// collection row with a visitDate in the given month, in the same
// transaction as recording the EmballageReportRun itself, so a finalized
// report always corresponds to a consistent lock state. One finalization
// per calendar month — re-finalizing an already-finalized month is
// rejected rather than silently re-running (unlike the idempotent-by-design
// patterns elsewhere, there is no safe "re-run" here: once a manager has
// reconciled a month, a second finalize could only mean confusion, not a
// legitimate retry).
export async function finalizeEmballageReport(
  input: FinalizeEmballageReportInput,
  actorId: string,
): Promise<void> {
  const existing = await findEmballageReportRun(input.periodMonth, input.periodYear);
  if (existing) throw new EmballageReportAlreadyFinalizedError();

  await runInTransaction(async (tx) => {
    await lockEmballageCollectionsForPeriod(input.periodMonth, input.periodYear, tx);
    await createEmballageReportRunRow(
      {
        periodMonth: input.periodMonth,
        periodYear: input.periodYear,
        finalizedByUser: { connect: { id: actorId } },
      },
      tx,
    );
  });
}
