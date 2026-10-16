import { type PagedResult, type PaginationParams, toSkipTake } from "@/lib/pagination";
import type {
  CreatePrescriptionTargetInput,
  RecordPrescriptionUpdateInput,
  UpdatePrescriptionTargetInput,
} from "@/lib/schemas/prescription";
import {
  countPrescriptionTargets,
  createPrescriptionTargetRevisionRow,
  createPrescriptionTargetRow,
  createPrescriptionUpdateRow,
  findLatestUpdateForTarget,
  findLatestUpdatesForTargetIds,
  findLatestUpdatesForUserTargets,
  findPrescriptionTargetById,
  findPrescriptionTargetByUniqueKey,
  findRevisionsForTarget,
  incrementUpdateSequence,
  listPrescriptionTargets,
  listUpdatesForTarget,
  type PrescriptionTargetRevisionRow,
  type PrescriptionTargetRow,
  type PrescriptionUpdateRow,
  runInTransaction,
  updatePrescriptionTargetRow,
} from "@/server/repositories/prescription-repository";
import { getUserScope, isWithinScope, type ScopeSession, scopeUserIds } from "@/server/scope";
import { assertAssigneeInScope } from "@/server/services/activity-service";

export class PrescriptionTargetNotFoundError extends Error {
  constructor() {
    super("Target not found.");
    this.name = "PrescriptionTargetNotFoundError";
  }
}

export class PrescriptionTargetDuplicateError extends Error {
  constructor() {
    super("A target for this prescriber, product, delegate and month already exists.");
    this.name = "PrescriptionTargetDuplicateError";
  }
}

export class PrescriptionNotAuthorizedError extends Error {
  constructor() {
    super("You can only record progress on your own targets.");
    this.name = "PrescriptionNotAuthorizedError";
  }
}

// Thrown when the server detects (inside the locked transaction) that the
// submitted cumulative value is lower than the current latest, and the
// submission didn't come with confirmDecrease: true. Carries the real,
// just-read latest value so the UI can show the current figure rather than
// whatever the page happened to load with — a concurrent update could have
// changed it since.
export class PrescriptionDecreaseConfirmationRequiredError extends Error {
  constructor(public readonly currentAchieved: number) {
    super("The new value is lower than the current recorded value and needs confirmation.");
    this.name = "PrescriptionDecreaseConfirmationRequiredError";
  }
}

// Thrown when confirmDecrease: true is set but correctionReason is blank —
// a reason is mandatory for every confirmed decrease, not merely suggested.
// Carries currentAchieved too, same reason as the error above, so the UI
// can keep the confirmation dialog open with the correct figure while
// prompting for the missing reason.
export class PrescriptionCorrectionReasonRequiredError extends Error {
  constructor(public readonly currentAchieved: number) {
    super("A correction reason is required when the achieved count decreases.");
    this.name = "PrescriptionCorrectionReasonRequiredError";
  }
}

export type PrescriptionTargetSummary = {
  id: string;
  monthlyTarget: number;
  periodMonth: number;
  periodYear: number;
  contact: { id: string; name: string };
  product: { id: string; name: string; code: string };
  user: { id: string; name: string };
  achieved: number;
  remaining: number;
};

function toProgress(target: PrescriptionTargetRow, latest: { cumulativeAchieved: number } | null) {
  const achieved = latest?.cumulativeAchieved ?? 0;
  return { achieved, remaining: Math.max(target.monthlyTarget - achieved, 0) };
}

function toSummary(
  target: PrescriptionTargetRow,
  latest: { cumulativeAchieved: number } | null,
): PrescriptionTargetSummary {
  const { achieved, remaining } = toProgress(target, latest);
  return {
    id: target.id,
    monthlyTarget: target.monthlyTarget,
    periodMonth: target.periodMonth,
    periodYear: target.periodYear,
    contact: target.contact,
    product: target.product,
    user: target.user,
    achieved,
    remaining,
  };
}

export type PrescriptionUpdateSummary = {
  id: string;
  sequenceNo: number;
  cumulativeAchieved: number;
  feedback: string | null;
  challenges: string | null;
  followUpDate: Date | null;
  acknowledgedDecrease: boolean;
  correctionReason: string | null;
  recordedAt: Date;
  recordedBy: { id: string; name: string };
};

function toUpdateSummary(row: PrescriptionUpdateRow): PrescriptionUpdateSummary {
  return {
    id: row.id,
    sequenceNo: row.sequenceNo,
    cumulativeAchieved: row.cumulativeAchieved,
    feedback: row.feedback,
    challenges: row.challenges,
    followUpDate: row.followUpDate,
    acknowledgedDecrease: row.acknowledgedDecrease,
    correctionReason: row.correctionReason,
    recordedAt: row.recordedAt,
    recordedBy: row.recordedByUser,
  };
}

export type PrescriptionTargetRevisionSummary = {
  id: string;
  previousTarget: number;
  newTarget: number;
  reason: string | null;
  changedBy: { id: string; name: string };
  changedAt: Date;
};

function toRevisionSummary(row: PrescriptionTargetRevisionRow): PrescriptionTargetRevisionSummary {
  return {
    id: row.id,
    previousTarget: row.previousTarget,
    newTarget: row.newTarget,
    reason: row.reason,
    changedBy: row.changedByUser,
    changedAt: row.changedAt,
  };
}

// Manager-facing: creates a new target for a delegate within the caller's
// scope. The (contact, product, delegate, month, year) grain is enforced
// both here (pre-check, for a clean error) and at the database level (the
// unique index) as a final guard against a race between two concurrent
// creates.
export async function createPrescriptionTarget(
  input: CreatePrescriptionTargetInput,
  session: ScopeSession,
): Promise<PrescriptionTargetSummary> {
  const scope = await getUserScope(session);
  await assertAssigneeInScope(input.userId, scope);

  const existing = await findPrescriptionTargetByUniqueKey(
    input.contactId,
    input.productId,
    input.userId,
    input.periodMonth,
    input.periodYear,
  );
  if (existing) throw new PrescriptionTargetDuplicateError();

  const created = await createPrescriptionTargetRow({
    contact: { connect: { id: input.contactId } },
    product: { connect: { id: input.productId } },
    user: { connect: { id: input.userId } },
    monthlyTarget: input.monthlyTarget,
    periodMonth: input.periodMonth,
    periodYear: input.periodYear,
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });
  return toSummary(created, null);
}

// Manager-facing: edits monthlyTarget on an existing target. Writes a
// PrescriptionTargetRevision audit row in the same transaction whenever the
// value actually changes — same convention as EmballageCorrection. A no-op
// edit (same value resubmitted) writes nothing.
export async function updatePrescriptionTarget(
  input: UpdatePrescriptionTargetInput,
  session: ScopeSession,
): Promise<PrescriptionTargetSummary> {
  const existing = await findPrescriptionTargetById(input.id);
  if (!existing) throw new PrescriptionTargetNotFoundError();

  const scope = await getUserScope(session);
  if (!isWithinScope(scope, existing.userId)) throw new PrescriptionTargetNotFoundError();

  if (input.monthlyTarget === existing.monthlyTarget) {
    const [latest] = await listUpdatesForTarget(existing.id);
    return toSummary(existing, latest ?? null);
  }

  const updated = await runInTransaction(async (tx) => {
    const row = await updatePrescriptionTargetRow(
      input.id,
      input.monthlyTarget,
      session.user.id,
      tx,
    );
    await createPrescriptionTargetRevisionRow(
      {
        target: { connect: { id: input.id } },
        previousTarget: existing.monthlyTarget,
        newTarget: input.monthlyTarget,
        reason: input.reason ?? null,
        changedByUser: { connect: { id: session.user.id } },
      },
      tx,
    );
    return row;
  });

  const [latest] = await listUpdatesForTarget(updated.id);
  return toSummary(updated, latest ?? null);
}

export async function getPrescriptionTargetDetail(
  id: string,
  session: ScopeSession,
): Promise<{
  target: PrescriptionTargetSummary;
  updates: PrescriptionUpdateSummary[];
  revisions: PrescriptionTargetRevisionSummary[];
} | null> {
  const target = await findPrescriptionTargetById(id);
  if (!target) return null;

  const scope = await getUserScope(session);
  if (!isWithinScope(scope, target.userId)) return null;

  const [updates, revisions] = await Promise.all([
    listUpdatesForTarget(id),
    findRevisionsForTarget(id),
  ]);
  const latest = updates[0] ?? null;

  return {
    target: toSummary(target, latest),
    updates: updates.map(toUpdateSummary),
    revisions: revisions.map(toRevisionSummary),
  };
}

// Delegate-facing (also usable by a manager/supervisor recording progress
// against their *own* target — see the authorization note below): records
// a new cumulative value, append-only, never editing a past row.
//
// Concurrency: inside one transaction —
//   1. incrementUpdateSequence takes the row lock (the UPDATE itself, not a
//      SELECT) and hands back the sequence number this submission will use.
//   2. findLatestUpdateForTarget reads the prior latest value — safe to do
//      only now, because the lock from step 1 blocks any concurrent
//      submission on the same target until this transaction commits.
//   3. Decrease handling: if the new value is lower than the value just
//      read, a confirmed submission (confirmDecrease: true) is required,
//      and a non-blank correctionReason is required alongside it. Neither
//      check can be expressed in the Zod schema alone since both depend on
//      reading DB state inside the transaction.
//   4. Insert the new PrescriptionUpdate with the sequence number from
//      step 1.
// Any throw here rolls back the whole transaction, including the sequence
// increment from step 1 — a rejected submission never consumes a sequence
// number, so a retried, confirmed submission gets the next clean one.
//
// Authorization: ownership only, no role bypass — target.userId must equal
// the acting user's id, unconditionally. Same rule Emballage's
// correctEmballageCollection applies to an unlocked row: holding the
// coarse permission (prescriptions:update-progress) says you're eligible in
// principle, not that you may act on someone else's record.
export async function recordPrescriptionUpdate(
  input: RecordPrescriptionUpdateInput,
  actorId: string,
): Promise<PrescriptionUpdateSummary> {
  const target = await findPrescriptionTargetById(input.targetId);
  if (!target) throw new PrescriptionTargetNotFoundError();
  if (target.userId !== actorId) throw new PrescriptionNotAuthorizedError();

  const created = await runInTransaction(async (tx) => {
    const sequenceNo = await incrementUpdateSequence(input.targetId, tx);
    const latest = await findLatestUpdateForTarget(input.targetId, tx);

    const isDecrease = latest !== null && input.cumulativeAchieved < latest.cumulativeAchieved;
    if (isDecrease) {
      if (!input.confirmDecrease) {
        throw new PrescriptionDecreaseConfirmationRequiredError(latest.cumulativeAchieved);
      }
      if (!input.correctionReason || input.correctionReason.trim().length === 0) {
        throw new PrescriptionCorrectionReasonRequiredError(latest.cumulativeAchieved);
      }
    }

    return createPrescriptionUpdateRow(
      {
        target: { connect: { id: input.targetId } },
        sequenceNo,
        cumulativeAchieved: input.cumulativeAchieved,
        feedback: input.feedback ?? null,
        challenges: input.challenges ?? null,
        followUpDate: input.followUpDate ? new Date(input.followUpDate) : null,
        acknowledgedDecrease: isDecrease,
        correctionReason: isDecrease ? (input.correctionReason ?? null) : null,
        recordedByUser: { connect: { id: actorId } },
      },
      tx,
    );
  });

  return toUpdateSummary(created);
}

export type PrescriptionTargetListFilters = {
  contactId?: string;
  productId?: string;
  periodMonth?: number;
  periodYear?: number;
};

async function enrichWithProgress(
  targets: PrescriptionTargetRow[],
): Promise<PrescriptionTargetSummary[]> {
  const latestByTarget = await findLatestUpdatesForTargetIds(targets.map((t) => t.id));
  const latestMap = new Map(latestByTarget.map((u) => [u.targetId, u]));
  return targets.map((target) => toSummary(target, latestMap.get(target.id) ?? null));
}

export async function getMyPrescriptionTargetsPage(
  userId: string,
  pagination: PaginationParams,
  filters: PrescriptionTargetListFilters = {},
): Promise<PagedResult<PrescriptionTargetSummary>> {
  const query = { userScopeUserIds: [userId], ...filters, ...toSkipTake(pagination) };
  const [rows, total] = await Promise.all([
    listPrescriptionTargets(query),
    countPrescriptionTargets(query),
  ]);
  return {
    items: await enrichWithProgress(rows),
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
}

export async function getTeamPrescriptionTargetsPage(
  session: ScopeSession,
  pagination: PaginationParams,
  filters: PrescriptionTargetListFilters = {},
): Promise<PagedResult<PrescriptionTargetSummary>> {
  const scope = await getUserScope(session);
  const query = {
    userScopeUserIds: scopeUserIds(scope),
    ...filters,
    ...toSkipTake(pagination),
  };
  const [rows, total] = await Promise.all([
    listPrescriptionTargets(query),
    countPrescriptionTargets(query),
  ]);
  return {
    items: await enrichWithProgress(rows),
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
}

export type HomePrescriptionFollowUp = {
  targetId: string;
  dueDate: Date;
  contactName: string;
  productName: string;
};

// Home screen integration (§ design agreed with the user): a prescription
// follow-up is never a FollowUp row — it's derived live from the latest
// PrescriptionUpdate per target. If the latest update for a target didn't
// set a followUpDate (even if an older one did), nothing is shown — no
// stale date, no status field, no scheduled cleanup needed.
export async function getMyPrescriptionFollowUps(
  userId: string,
): Promise<HomePrescriptionFollowUp[]> {
  const latest = await findLatestUpdatesForUserTargets(userId);
  return latest
    .filter((update) => update.followUpDate !== null)
    .map((update) => ({
      targetId: update.targetId,
      dueDate: update.followUpDate as Date,
      contactName: update.target.contact.name,
      productName: update.target.product.name,
    }));
}
