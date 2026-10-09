import { type PagedResult, type PaginationParams, toSkipTake } from "@/lib/pagination";
import type { AssignActivityInput, CreateActivityInput } from "@/lib/schemas/activity";
import {
  type ActivityQuery,
  type ActivityRow,
  assignActivityRow,
  countActivities,
  createActivityRow,
  findActivityById,
  listActivities,
  updateActivityStatus as updateActivityStatusRow,
} from "@/server/repositories/activity-repository";
import {
  findAllUsersInScope,
  findUserById,
  findUserIdsByRoleName,
} from "@/server/repositories/user-repository";
import {
  getUserScope,
  isWithinScope,
  type Scope,
  type ScopeSession,
  scopeUserIds,
} from "@/server/scope";

export class ActivityNotFoundError extends Error {
  constructor() {
    super("Activity not found.");
    this.name = "ActivityNotFoundError";
  }
}

export class ActivityNotAuthorizedError extends Error {
  constructor() {
    super("You can only act on an activity assigned to you, or one you manage.");
    this.name = "ActivityNotAuthorizedError";
  }
}

export class AssigneeOutsideScopeError extends Error {
  constructor() {
    super("You can only assign an activity to yourself or someone in your team.");
    this.name = "AssigneeOutsideScopeError";
  }
}

export class ActivityNotReassignableError extends Error {
  constructor() {
    super("Only a planned activity can be assigned or reassigned.");
    this.name = "ActivityNotReassignableError";
  }
}

export type ActivitySummary = {
  id: string;
  type: string;
  date: Date;
  status: string;
  notes: string | null;
  center: { id: string; name: string; code: string } | null;
  territory: { id: string; code: string } | null;
  // Null = created but not yet assigned.
  owner: { id: string; name: string } | null;
};

function toSummary(row: ActivityRow): ActivitySummary {
  return {
    id: row.id,
    type: row.type,
    date: row.date,
    status: row.status,
    notes: row.notes,
    center: row.center,
    territory: row.territory,
    owner: row.owner,
  };
}

// Created unassigned on purpose — only the Assignment step decides who does
// it (see assignActivity).
export async function createActivity(
  input: CreateActivityInput,
  actorId: string,
): Promise<ActivitySummary> {
  const created = await createActivityRow({
    type: input.type,
    date: new Date(input.date),
    notes: input.notes ?? undefined,
    center: input.centerId ? { connect: { id: input.centerId } } : undefined,
    territory: input.territoryId ? { connect: { id: input.territoryId } } : undefined,
    createdBy: actorId,
    updatedBy: actorId,
  });
  return toSummary(created);
}

const ADMIN_ROLE_NAME = "ADMIN";

// An unassigned activity has no owner to scope on, so its creator stands in
// for one: a manager's own team, or an admin — admins create activities for
// managers to pick up and assign, so no one manager's team contains them.
function isActivityWithinScope(scope: Scope, row: ActivityRow, adminIds: string[]): boolean {
  if (row.ownerId) return isWithinScope(scope, row.ownerId);
  if (!row.createdBy) return scope.kind === "all";
  return isWithinScope(scope, row.createdBy) || adminIds.includes(row.createdBy);
}

// A manager (`canAssign`) can assign any activity inside their scope; anyone
// else can only act on one assigned to themselves.
function assertCanActOn(
  row: ActivityRow,
  actorId: string,
  scope: Scope,
  canAssign: boolean,
  adminIds: string[],
): void {
  if (row.ownerId === actorId) return;
  if (canAssign && isActivityWithinScope(scope, row, adminIds)) return;
  throw new ActivityNotAuthorizedError();
}

// Loads the activity and enforces the "owner, or a manager over it" rule —
// shared by status changes here and by follow-up creation, so both apply
// exactly the same check.
export async function getActivityForAction(
  id: string,
  session: ScopeSession,
  canAssign: boolean,
): Promise<ActivityRow> {
  const activity = await findActivityById(id);
  if (!activity) throw new ActivityNotFoundError();

  const scope = await getUserScope(session);
  const adminIds = canAssign ? await findUserIdsByRoleName(ADMIN_ROLE_NAME) : [];
  assertCanActOn(activity, session.user.id, scope, canAssign, adminIds);
  return activity;
}

export async function assignActivity(
  input: AssignActivityInput,
  session: ScopeSession,
): Promise<ActivitySummary> {
  const scope = await getUserScope(session);

  const activity = await findActivityById(input.id);
  if (!activity) throw new ActivityNotFoundError();
  const adminIds = await findUserIdsByRoleName(ADMIN_ROLE_NAME);
  if (!isActivityWithinScope(scope, activity, adminIds)) throw new ActivityNotAuthorizedError();
  if (activity.status !== "PLANNED") throw new ActivityNotReassignableError();

  const assignee = await findUserById(input.ownerId, scopeUserIds(scope));
  if (!assignee || assignee.status !== "ACTIVE") throw new AssigneeOutsideScopeError();

  const updated = await assignActivityRow(input.id, input.ownerId, session.user.id);
  return toSummary(updated);
}

export async function updateActivityStatus(
  id: string,
  status: "PLANNED" | "DONE" | "CANCELLED",
  session: ScopeSession,
  canAssign: boolean,
): Promise<ActivitySummary> {
  await getActivityForAction(id, session, canAssign);

  const updated = await updateActivityStatusRow(id, status, session.user.id);
  return toSummary(updated);
}

// Scoped per the viewer's hierarchy — same getUserScope/scopeUserIds
// pattern as every other list/report query (AGENTS.md: a missed hierarchy
// filter here is a breach, not a bug). A manager (`canAssign`) sees every
// activity in their team, plus unassigned ones created by their team or by
// an admin; everyone else sees only activities assigned to themselves, even
// a supervisor whose scope reaches further.
async function viewerVisibility(
  session: ScopeSession,
  canAssign: boolean,
): Promise<Pick<ActivityQuery, "ownerIds" | "unassignedCreatorIds">> {
  if (!canAssign) return { ownerIds: [session.user.id] };

  const scope = await getUserScope(session);
  const ids = scopeUserIds(scope);
  const adminIds = await findUserIdsByRoleName(ADMIN_ROLE_NAME);
  return { ownerIds: ids, unassignedCreatorIds: ids ? [...ids, ...adminIds] : undefined };
}

// One page of the viewer's activities (newest date first) — the list and the
// Assignment tab. `unassignedOnly` narrows to activities still waiting for
// an assignee.
export async function getActivitiesPageForViewer(
  session: ScopeSession,
  canAssign: boolean,
  pagination: PaginationParams,
  options: { unassignedOnly?: boolean } = {},
): Promise<PagedResult<ActivitySummary>> {
  const query: ActivityQuery = {
    ...(await viewerVisibility(session, canAssign)),
    unassignedOnly: options.unassignedOnly,
  };
  const [rows, total] = await Promise.all([
    listActivities({ ...query, ...toSkipTake(pagination) }),
    countActivities(query),
  ]);
  return {
    items: rows.map(toSummary),
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
}

// Everything the viewer can see in one calendar month — bounded by the
// month itself, so the calendar never loads the whole table. `month` is
// 0-indexed, matching Date#getUTCMonth().
export async function getActivitiesForMonth(
  session: ScopeSession,
  canAssign: boolean,
  year: number,
  month: number,
): Promise<ActivitySummary[]> {
  const rows = await listActivities({
    ...(await viewerVisibility(session, canAssign)),
    from: new Date(Date.UTC(year, month, 1)),
    to: new Date(Date.UTC(year, month + 1, 1)),
  });
  return rows.map(toSummary);
}

// Who a manager can pick on the Assignment tab: active users inside their
// scope (themselves and their downstream team) — the same set
// assignActivity accepts, so the picker never offers someone the server
// would then reject.
export async function listAssignableUsers(
  session: ScopeSession,
): Promise<{ id: string; label: string }[]> {
  const scope = await getUserScope(session);
  const users = await findAllUsersInScope(scopeUserIds(scope));
  return users
    .filter((user) => user.status === "ACTIVE")
    .map((user) => ({ id: user.id, label: `${user.name} (${user.role.name})` }));
}
