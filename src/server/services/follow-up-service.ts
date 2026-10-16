import { type PagedResult, type PaginationParams, toSkipTake } from "@/lib/pagination";
import type {
  CompleteFollowUpInput,
  CreateFollowUpInput,
  ReassignFollowUpInput,
} from "@/lib/schemas/follow-up";
import {
  completeFollowUpRow,
  countFollowUps,
  createFollowUpReassignmentRow,
  createFollowUpRow,
  type Db,
  findFollowUpById,
  findPendingFollowUps,
  findPendingFollowUpsForUser,
  findReassignmentsForFollowUp,
  type FollowUpReassignmentRow,
  type FollowUpRow,
  listFollowUps,
  runInTransaction,
  updateFollowUpOwnerRow,
} from "@/server/repositories/follow-up-repository";
import { getUserScope, isWithinScope, type ScopeSession, scopeUserIds } from "@/server/scope";

import {
  ActivityNotAuthorizedError,
  assertAssigneeInScope,
  AssignmentNotActionableError,
  AssignmentNotFoundError,
  getAssignmentForAction,
} from "./activity-service";

export type FollowUpSummary = {
  id: string;
  dueDate: Date;
  status: string;
  assignmentId: string;
  ownerId: string;
  ownerName: string;
  outcome: string | null;
  prescriptionsGenerated: number | null;
  businessValueGenerated: string | null;
  productAvailable: boolean | null;
  seriesIntervalDays: number | null;
  seriesEndDate: Date | null;
  participant: { id: string; name: string } | null;
  activity: {
    id: string;
    name: string;
    location: string | null;
    type: { id: string; code: string; name: string };
    center: { id: string; name: string } | null;
    territory: { id: string; code: string } | null;
  };
};

export type FollowUpReassignmentSummary = {
  id: string;
  previousOwner: { id: string; name: string };
  newOwner: { id: string; name: string };
  reassignedBy: { id: string; name: string };
  reassignedAt: Date;
};

function toSummary(row: FollowUpRow): FollowUpSummary {
  return {
    id: row.id,
    dueDate: row.dueDate,
    status: row.status,
    assignmentId: row.assignment.id,
    ownerId: row.ownerId,
    ownerName: row.owner.name,
    outcome: row.outcome,
    prescriptionsGenerated: row.prescriptionsGenerated,
    businessValueGenerated: row.businessValueGenerated?.toString() ?? null,
    productAvailable: row.productAvailable,
    seriesIntervalDays: row.seriesIntervalDays,
    seriesEndDate: row.seriesEndDate,
    participant: row.participantResult?.contact ?? null,
    activity: row.assignment.activity,
  };
}

function toReassignmentSummary(row: FollowUpReassignmentRow): FollowUpReassignmentSummary {
  return {
    id: row.id,
    previousOwner: row.previousOwner,
    newOwner: row.newOwner,
    reassignedBy: row.reassignedByUser,
    reassignedAt: row.reassignedAt,
  };
}

// The follow-up belongs to the assignment it's raised against, whoever
// creates it. It starts out owned by the assignee — a manager adding one
// for their team doesn't take ownership of it; ownership only moves via
// reassignFollowUp. The assignment must still be PLANNED: no point raising
// a follow-up against work that's already done or cancelled.
export async function createFollowUp(
  input: CreateFollowUpInput,
  session: ScopeSession,
  canAssign: boolean,
): Promise<FollowUpSummary> {
  const assignment = await getAssignmentForAction(input.assignmentId, session, canAssign);
  if (assignment.status !== "PLANNED") throw new AssignmentNotActionableError();

  const created = await createFollowUpRow({
    assignment: { connect: { id: input.assignmentId } },
    owner: { connect: { id: assignment.user.id } },
    dueDate: new Date(input.dueDate),
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });
  return toSummary(created);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

// Duck-typed rather than `instanceof Prisma.PrismaClientKnownRequestError`
// — same reasoning as territory-service.ts's helper of the same name.
function isUniqueConstraintViolation(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

// Trigger 2 of the follow-up chain engine (§3.5): a completed follow-up
// with a configured interval advances to its next link. Scheduled off the
// *due* date, not the completion timestamp, so a late completion doesn't
// shift the whole cadence. seriesIntervalDays/seriesEndDate are copied
// forward unchanged onto the child — not re-read from ActivityTypeDef —
// so an in-flight chain isn't reshaped by a later config change. The
// unique parentFollowUpId constraint means a concurrent duplicate
// completion can create at most one child; the rare race is swallowed here
// rather than bubbled as a raw constraint-violation error.
async function advanceFollowUpChain(
  completed: FollowUpRow,
  actorId: string,
  tx: Db,
): Promise<void> {
  if (completed.seriesIntervalDays == null) return;
  const nextDue = addDays(completed.dueDate, completed.seriesIntervalDays);
  if (completed.seriesEndDate && nextDue.getTime() > completed.seriesEndDate.getTime()) return;

  try {
    await createFollowUpRow(
      {
        assignment: { connect: { id: completed.assignment.id } },
        owner: { connect: { id: completed.ownerId } },
        participantResult: completed.participantResult
          ? { connect: { id: completed.participantResult.id } }
          : undefined,
        dueDate: nextDue,
        seriesIntervalDays: completed.seriesIntervalDays,
        seriesEndDate: completed.seriesEndDate,
        parentFollowUp: { connect: { id: completed.id } },
        createdBy: actorId,
        updatedBy: actorId,
      },
      tx,
    );
  } catch (error) {
    if (isUniqueConstraintViolation(error) && error.code === "P2002") return;
    throw error;
  }
}

// Only the follow-up's current owner can complete it — decoupled from
// assignment.userId on purpose, since ownership may have moved via
// reassignFollowUp. Already-DONE is treated as a no-op rather than an
// error, so a duplicate submit (double click, retry) can't double-advance
// the chain.
export async function completeFollowUp(
  input: CompleteFollowUpInput,
  actorId: string,
): Promise<FollowUpSummary> {
  const followUp = await findFollowUpById(input.id);
  if (!followUp) throw new AssignmentNotFoundError();
  if (followUp.ownerId !== actorId) throw new ActivityNotAuthorizedError();
  if (followUp.status !== "PENDING") return toSummary(followUp);

  const updated = await runInTransaction(async (tx) => {
    const completed = await completeFollowUpRow(
      input.id,
      actorId,
      {
        outcome: input.outcome ?? null,
        prescriptionsGenerated: input.prescriptionsGenerated ?? null,
        businessValueGenerated: input.businessValueGenerated?.toString() ?? null,
        productAvailable: input.productAvailable ?? null,
      },
      tx,
    );
    await advanceFollowUpChain(completed, actorId, tx);
    return completed;
  });
  return toSummary(updated);
}

// reassignFollowUp updates the current row's ownerId in place (unlike
// assignment reassignment, which cancels and recreates) and writes one
// FollowUpReassignment audit row in the same transaction. A manager-level
// action: the current owner must be within the actor's reporting scope,
// same as every other per-assignment action, and the new owner must be a
// valid, active, in-scope user (assertAssigneeInScope, shared with
// reassignAssignment).
export async function reassignFollowUp(
  input: ReassignFollowUpInput,
  session: ScopeSession,
): Promise<FollowUpSummary> {
  const followUp = await findFollowUpById(input.id);
  if (!followUp) throw new AssignmentNotFoundError();

  const scope = await getUserScope(session);
  if (!isWithinScope(scope, followUp.ownerId)) throw new ActivityNotAuthorizedError();
  await assertAssigneeInScope(input.newOwnerId, scope);

  const updated = await runInTransaction(async (tx) => {
    const row = await updateFollowUpOwnerRow(input.id, input.newOwnerId, session.user.id, tx);
    await createFollowUpReassignmentRow(
      {
        followUp: { connect: { id: input.id } },
        previousOwner: { connect: { id: followUp.ownerId } },
        newOwner: { connect: { id: input.newOwnerId } },
        reassignedByUser: { connect: { id: session.user.id } },
      },
      tx,
    );
    return row;
  });
  return toSummary(updated);
}

// Viewable by the current owner, or anyone whose scope reaches the owner
// and holds either activities:assign (who can also reassign from here) or
// activities:view-team (read-only — same read-wider-than-write split as
// assertCanViewAssignment in activity-service.ts). Includes the full
// reassignment history so an ownership-change trail is visible.
export async function getFollowUpDetail(
  id: string,
  session: ScopeSession,
  canAssign: boolean,
  canViewTeam: boolean,
): Promise<{ followUp: FollowUpSummary; reassignments: FollowUpReassignmentSummary[] } | null> {
  const followUp = await findFollowUpById(id);
  if (!followUp) return null;

  const isOwner = followUp.ownerId === session.user.id;
  if (!isOwner) {
    if (!canAssign && !canViewTeam) return null;
    const scope = await getUserScope(session);
    if (!isWithinScope(scope, followUp.ownerId)) return null;
  }

  const reassignments = await findReassignmentsForFollowUp(id);
  return { followUp: toSummary(followUp), reassignments: reassignments.map(toReassignmentSummary) };
}

// "Pending" = not yet done, "overdue" = pending AND past its due date as of
// `asOf` (defaults to now). Split from one underlying query rather than two
// separate repository calls, so the two lists the delegate home-screen
// widget needs (pending, overdue) always agree with each other. Owner-
// scoped: once a follow-up is reassigned, it shows up for its new owner,
// not the original assignee.
export async function getMyFollowUps(
  userId: string,
  asOf: Date = new Date(),
): Promise<{ pending: FollowUpSummary[]; overdue: FollowUpSummary[] }> {
  const rows = await findPendingFollowUpsForUser(userId);
  const summaries = rows.map(toSummary);
  const overdue = summaries.filter((f) => f.dueDate.getTime() < asOf.getTime());
  return { pending: summaries, overdue };
}

// Scoped team view — every PENDING follow-up across the viewer's team, not
// just overdue ones. A manager needs this to find and reassign a follow-up
// *before* it goes overdue, not only after — an overdue-only list left no
// path to reach a follow-up that hadn't missed its date yet. Same
// pending/overdue split as getMyFollowUps, same getUserScope/scopeUserIds
// pattern as every other list query.
export async function getTeamFollowUps(
  session: ScopeSession,
  asOf: Date = new Date(),
): Promise<{ pending: FollowUpSummary[]; overdue: FollowUpSummary[] }> {
  const scope = await getUserScope(session);
  const rows = await findPendingFollowUps(scopeUserIds(scope));
  const summaries = rows.map(toSummary);
  const overdue = summaries.filter((f) => f.dueDate.getTime() < asOf.getTime());
  return { pending: summaries, overdue };
}

export type FollowUpListFilters = {
  q?: string;
  typeId?: string;
  status?: "PENDING" | "DONE";
  overdueOnly?: boolean;
  from?: string;
  to?: string;
};

function toQueryFilters(filters: FollowUpListFilters, asOf: Date) {
  return {
    q: filters.q,
    typeId: filters.typeId,
    status: filters.status,
    overdueOnly: filters.overdueOnly,
    asOf,
    from: filters.from ? new Date(filters.from) : undefined,
    // `to` is a calendar date from the date picker — extended to the end
    // of that day so a follow-up due that same day is included, same
    // convention as getActivitiesPageForViewer's own date-range handling.
    to: filters.to ? new Date(`${filters.to}T23:59:59.999Z`) : undefined,
  };
}

// The filtered, paginated My Follow-Ups table — unlike getMyFollowUps
// (used by the compact Home widget, which always wants everything
// unpaginated), this is what the dedicated My Follow-Ups screen uses.
export async function getMyFollowUpsPage(
  userId: string,
  pagination: PaginationParams,
  filters: FollowUpListFilters = {},
  asOf: Date = new Date(),
): Promise<PagedResult<FollowUpSummary>> {
  const query = {
    ownerScopeUserIds: [userId],
    ...toQueryFilters(filters, asOf),
    ...toSkipTake(pagination),
  };
  const [rows, total] = await Promise.all([listFollowUps(query), countFollowUps(query)]);
  return {
    items: rows.map(toSummary),
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
}

// The filtered, paginated Team Follow-Ups table — same scoping as
// getTeamFollowUps, but filtered and paginated rather than returning
// everything split into pending/overdue.
export async function getTeamFollowUpsPage(
  session: ScopeSession,
  pagination: PaginationParams,
  filters: FollowUpListFilters = {},
  asOf: Date = new Date(),
): Promise<PagedResult<FollowUpSummary>> {
  const scope = await getUserScope(session);
  const query = {
    ownerScopeUserIds: scopeUserIds(scope),
    ...toQueryFilters(filters, asOf),
    ...toSkipTake(pagination),
  };
  const [rows, total] = await Promise.all([listFollowUps(query), countFollowUps(query)]);
  return {
    items: rows.map(toSummary),
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
}
