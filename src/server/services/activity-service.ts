import { type PagedResult, type PaginationParams, toSkipTake } from "@/lib/pagination";
import type {
  ActivityAssigneeSearchQuery,
  ActivityAssignmentFilters,
  ActivityListParams,
  ActivitySearchQuery,
  CreateActivityInput,
  CreateAssignmentInput,
  ReassignAssignmentInput,
  UpdateActivityInput,
} from "@/lib/schemas/activity";
import {
  type ActivityAssignmentQuery,
  type ActivityAssignmentRow,
  type ActivityQuery,
  type ActivityRow,
  countActivities,
  countAssignments,
  createActivityRow,
  createAssignmentRow,
  findActivePlannedAssignment,
  findActivityById,
  findAssignmentById,
  listActivities,
  listAssignments,
  runInTransaction,
  searchActivities,
  updateActivityRow,
  updateAssignmentStatusRow,
} from "@/server/repositories/activity-repository";
import {
  findAllUsersInScope,
  findUserById,
  findUserIdsByRoleName,
  findUsersByIds,
  searchActiveUsers,
} from "@/server/repositories/user-repository";
import {
  getDownstreamUserIds,
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

export class AssignmentNotFoundError extends Error {
  constructor() {
    super("Assignment not found.");
    this.name = "AssignmentNotFoundError";
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

export class DuplicateAssignmentError extends Error {
  constructor() {
    super("This person is already assigned to this activity.");
    this.name = "DuplicateAssignmentError";
  }
}

export class AssignmentNotActionableError extends Error {
  constructor() {
    super("Only a planned assignment can be changed.");
    this.name = "AssignmentNotActionableError";
  }
}

const ADMIN_ROLE_NAME = "ADMIN";

export type AssignmentSummary = {
  id: string;
  status: string;
  scheduledDate: Date;
  user: { id: string; name: string };
};

export type ActivitySummary = {
  id: string;
  name: string;
  type: string;
  notes: string | null;
  center: { id: string; name: string; code: string } | null;
  territory: { id: string; code: string } | null;
  assignments: AssignmentSummary[];
  createdBy: string | null;
  createdByName: string | null;
  createdAt: Date;
};

export type ActivityAssignmentSummary = {
  id: string;
  status: string;
  scheduledDate: Date;
  user: { id: string; name: string };
  activity: {
    id: string;
    name: string;
    type: string;
    notes: string | null;
    center: { id: string; name: string; code: string } | null;
    territory: { id: string; code: string } | null;
  };
};

function toAssignmentSummary(row: {
  id: string;
  status: string;
  scheduledDate: Date;
  user: { id: string; name: string };
}): AssignmentSummary {
  return { id: row.id, status: row.status, scheduledDate: row.scheduledDate, user: row.user };
}

function toSummary(row: ActivityRow, createdByName: string | null = null): ActivitySummary {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    notes: row.notes,
    center: row.center,
    territory: row.territory,
    assignments: row.assignments.map(toAssignmentSummary),
    createdBy: row.createdBy,
    createdByName,
    createdAt: row.createdAt,
  };
}

function toActivityAssignmentSummary(row: ActivityAssignmentRow): ActivityAssignmentSummary {
  return {
    id: row.id,
    status: row.status,
    scheduledDate: row.scheduledDate,
    user: row.user,
    activity: row.activity,
  };
}

// createdBy is a plain audit-column id, not a relation (see
// user-repository's findUsersByIds), so names are resolved in one batch
// rather than joined.
async function withCreatorNames(rows: ActivityRow[]): Promise<ActivitySummary[]> {
  const ids = [
    ...new Set(rows.map((row) => row.createdBy).filter((id): id is string => Boolean(id))),
  ];
  const users = ids.length > 0 ? await findUsersByIds(ids) : [];
  const names = new Map(users.map((user) => [user.id, user.name]));
  return rows.map((row) =>
    toSummary(row, row.createdBy ? (names.get(row.createdBy) ?? null) : null),
  );
}

// Created unassigned on purpose — only the Assignment screen decides who
// does it (see createAssignment).
export async function createActivity(
  input: CreateActivityInput,
  actorId: string,
): Promise<ActivitySummary> {
  const created = await createActivityRow({
    name: input.name,
    type: input.type,
    notes: input.notes ?? undefined,
    center: input.centerId ? { connect: { id: input.centerId } } : undefined,
    territory: input.territoryId ? { connect: { id: input.territoryId } } : undefined,
    createdBy: actorId,
    updatedBy: actorId,
  });
  return toSummary(created);
}

// An unassigned activity has no assignee to scope on, so its creator stands
// in for one: a manager's own team, or an admin — admins create activities
// for managers to pick up and assign, so no one manager's team contains
// them. An activity with at least one assignment is in scope the moment any
// one of its assignees is.
function isActivityWithinScope(scope: Scope, row: ActivityRow, adminIds: string[]): boolean {
  if (row.assignments.length > 0) {
    return row.assignments.some((assignment) => isWithinScope(scope, assignment.user.id));
  }
  if (!row.createdBy) return scope.kind === "all";
  return isWithinScope(scope, row.createdBy) || adminIds.includes(row.createdBy);
}

async function assertCanManageActivity(
  row: ActivityRow,
  session: ScopeSession,
  canAssign: boolean,
): Promise<void> {
  if (!canAssign) throw new ActivityNotAuthorizedError();
  const scope = await getUserScope(session);
  const adminIds = await findUserIdsByRoleName(ADMIN_ROLE_NAME);
  if (!isActivityWithinScope(scope, row, adminIds)) throw new ActivityNotAuthorizedError();
}

// Loads the activity and enforces "you manage it" — shared by edits and new
// assignments.
export async function getActivityForManagement(
  id: string,
  session: ScopeSession,
  canAssign: boolean,
): Promise<ActivityRow> {
  const activity = await findActivityById(id);
  if (!activity) throw new ActivityNotFoundError();
  await assertCanManageActivity(activity, session, canAssign);
  return activity;
}

export async function updateActivity(
  input: UpdateActivityInput,
  session: ScopeSession,
  canAssign: boolean,
): Promise<ActivitySummary> {
  await getActivityForManagement(input.id, session, canAssign);

  const updated = await updateActivityRow(input.id, {
    name: input.name,
    type: input.type,
    notes: input.notes ?? null,
    center: input.centerId ? { connect: { id: input.centerId } } : { disconnect: true },
    territory: input.territoryId ? { connect: { id: input.territoryId } } : { disconnect: true },
    updatedBy: session.user.id,
  });
  return toSummary(updated);
}

// Viewable by anyone who manages it, or anyone who personally holds an
// assignment on it (even one that's since been cancelled — it's still their
// history). "Not found" and "not yours" are indistinguishable.
export async function getActivityDetail(
  id: string,
  session: ScopeSession,
  canAssign: boolean,
): Promise<ActivitySummary | null> {
  const activity = await findActivityById(id);
  if (!activity) return null;

  const ownsAnAssignment = activity.assignments.some(
    (assignment) => assignment.user.id === session.user.id,
  );
  if (ownsAnAssignment) {
    return withCreatorNames([activity]).then((rows) => rows[0] ?? null);
  }
  try {
    await assertCanManageActivity(activity, session, canAssign);
  } catch {
    return null;
  }
  const [summary] = await withCreatorNames([activity]);
  return summary ?? null;
}

// The rule shared by every per-assignment action: the assignee themselves,
// or a manager whose scope reaches them.
function assertCanActOnAssignment(
  assignment: ActivityAssignmentRow,
  actorId: string,
  scope: Scope,
  canAssign: boolean,
): void {
  if (assignment.user.id === actorId) return;
  if (canAssign && isWithinScope(scope, assignment.user.id)) return;
  throw new ActivityNotAuthorizedError();
}

export async function getAssignmentForAction(
  id: string,
  session: ScopeSession,
  canAssign: boolean,
): Promise<ActivityAssignmentRow> {
  const assignment = await findAssignmentById(id);
  if (!assignment) throw new AssignmentNotFoundError();
  const scope = await getUserScope(session);
  assertCanActOnAssignment(assignment, session.user.id, scope, canAssign);
  return assignment;
}

// Viewable by the assignee, or a manager whose scope reaches them.
export async function getAssignmentDetail(
  id: string,
  session: ScopeSession,
  canAssign: boolean,
): Promise<ActivityAssignmentSummary | null> {
  const assignment = await findAssignmentById(id);
  if (!assignment) return null;
  if (assignment.user.id === session.user.id) return toActivityAssignmentSummary(assignment);

  const scope = await getUserScope(session);
  if (canAssign && isWithinScope(scope, assignment.user.id)) {
    return toActivityAssignmentSummary(assignment);
  }
  return null;
}

async function assertAssigneeInScope(userId: string, scope: Scope): Promise<void> {
  const assignee = await findUserById(userId, scopeUserIds(scope));
  if (!assignee || assignee.status !== "ACTIVE") throw new AssigneeOutsideScopeError();
}

// A new, independent assignment — the activity may already carry other
// active assignments; this never touches them.
export async function createAssignment(
  input: CreateAssignmentInput,
  session: ScopeSession,
): Promise<ActivityAssignmentSummary> {
  const activity = await findActivityById(input.activityId);
  if (!activity) throw new ActivityNotFoundError();
  await assertCanManageActivity(activity, session, true);

  const scope = await getUserScope(session);
  await assertAssigneeInScope(input.userId, scope);

  const existing = await findActivePlannedAssignment(input.activityId, input.userId);
  if (existing) throw new DuplicateAssignmentError();

  const created = await createAssignmentRow(
    input.activityId,
    input.userId,
    new Date(input.scheduledDate),
    session.user.id,
  );
  return toActivityAssignmentSummary(created);
}

// Reassigns one specific assignment: cancels it and creates a fresh PLANNED
// one for the new user, leaving every other assignment on the same activity
// untouched.
export async function reassignAssignment(
  input: ReassignAssignmentInput,
  session: ScopeSession,
): Promise<ActivityAssignmentSummary> {
  const assignment = await findAssignmentById(input.assignmentId);
  if (!assignment) throw new AssignmentNotFoundError();
  if (assignment.status !== "PLANNED") throw new AssignmentNotActionableError();

  const scope = await getUserScope(session);
  if (!isWithinScope(scope, assignment.user.id)) throw new ActivityNotAuthorizedError();
  await assertAssigneeInScope(input.userId, scope);

  const existing = await findActivePlannedAssignment(assignment.activityId, input.userId);
  if (existing) throw new DuplicateAssignmentError();

  const created = await runInTransaction(async (tx) => {
    await updateAssignmentStatusRow(assignment.id, "CANCELLED", session.user.id, tx);
    return createAssignmentRow(
      assignment.activityId,
      input.userId,
      new Date(input.scheduledDate),
      session.user.id,
      tx,
    );
  });
  return toActivityAssignmentSummary(created);
}

export async function cancelAssignment(assignmentId: string, session: ScopeSession): Promise<void> {
  const assignment = await findAssignmentById(assignmentId);
  if (!assignment) throw new AssignmentNotFoundError();
  if (assignment.status !== "PLANNED") throw new AssignmentNotActionableError();

  const scope = await getUserScope(session);
  if (!isWithinScope(scope, assignment.user.id)) throw new ActivityNotAuthorizedError();

  await updateAssignmentStatusRow(assignmentId, "CANCELLED", session.user.id);
}

// The assignee's own response — mark their assignment done or cancel it.
// `canAssign` additionally lets a manager do this on behalf of someone in
// their scope, same reach as every other per-assignment action.
export async function updateAssignmentStatus(
  assignmentId: string,
  status: "DONE" | "CANCELLED",
  session: ScopeSession,
  canAssign: boolean,
): Promise<ActivityAssignmentSummary> {
  const assignment = await getAssignmentForAction(assignmentId, session, canAssign);
  if (assignment.status !== "PLANNED") throw new AssignmentNotActionableError();

  const updated = await updateAssignmentStatusRow(assignmentId, status, session.user.id);
  return toActivityAssignmentSummary(updated);
}

// Scoped per the viewer's hierarchy — same getUserScope/scopeUserIds
// pattern as every other list/report query (AGENTS.md: a missed hierarchy
// filter here is a breach, not a bug). A manager (`canAssign`) sees every
// activity with an assignment in their team, plus unassigned ones created by
// their team or by an admin; everyone else sees only activities where they
// personally hold an assignment, even a supervisor whose scope reaches
// further.
async function viewerVisibility(
  session: ScopeSession,
  canAssign: boolean,
): Promise<Pick<ActivityQuery, "assignedScopeUserIds" | "unassignedCreatorIds">> {
  if (!canAssign) return { assignedScopeUserIds: [session.user.id] };

  const scope = await getUserScope(session);
  const ids = scopeUserIds(scope);
  const adminIds = await findUserIdsByRoleName(ADMIN_ROLE_NAME);
  return {
    assignedScopeUserIds: ids,
    unassignedCreatorIds: ids ? [...ids, ...adminIds] : undefined,
  };
}

export type ActivityListFilters = Pick<ActivityListParams, "q" | "type" | "status" | "from" | "to">;

// One page of the viewer's activities (newest date first) — the Activity
// List, filtered by name, type, assignment status and date range.
export async function getActivitiesPageForViewer(
  session: ScopeSession,
  canAssign: boolean,
  pagination: PaginationParams,
  filters: ActivityListFilters = {},
): Promise<PagedResult<ActivitySummary>> {
  const query: ActivityQuery = {
    ...(await viewerVisibility(session, canAssign)),
    q: filters.q,
    type: filters.type,
    status: filters.status,
    from: filters.from ? new Date(filters.from) : undefined,
    to: filters.to ? new Date(`${filters.to}T23:59:59.999Z`) : undefined,
  };
  const [rows, total] = await Promise.all([
    listActivities({ ...query, ...toSkipTake(pagination) }),
    countActivities(query),
  ]);
  return {
    items: await withCreatorNames(rows),
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
}

// Every assignment scheduled in one calendar month, within the viewer's
// scope — bounded by the month itself, so the calendar never loads the
// whole table. One row per assignment (not per activity), since each
// assignee can be scheduled on a different date; a manager (`canAssign`)
// sees their team's, everyone else sees only their own. `month` is
// 0-indexed, matching Date#getUTCMonth().
export async function getAssignmentsForMonth(
  session: ScopeSession,
  canAssign: boolean,
  year: number,
  month: number,
): Promise<ActivityAssignmentSummary[]> {
  const { assignedScopeUserIds } = await viewerVisibility(session, canAssign);
  const rows = await listAssignments({
    scopeUserIds: assignedScopeUserIds,
    from: new Date(Date.UTC(year, month, 1)),
    to: new Date(Date.UTC(year, month + 1, 1)),
  });
  return rows.map(toActivityAssignmentSummary);
}

export type MyAssignmentFilters = Pick<ActivityListParams, "q" | "type" | "status" | "from" | "to">;

// One page of the viewer's own assignments — My Activities: one row per
// assignment, always scoped to the viewer themselves regardless of role
// (unlike the Assignment table, which reaches a manager's whole team).
export async function getMyAssignmentsPage(
  session: ScopeSession,
  pagination: PaginationParams,
  filters: MyAssignmentFilters = {},
): Promise<PagedResult<ActivityAssignmentSummary>> {
  const query: ActivityAssignmentQuery = {
    scopeUserIds: [session.user.id],
    q: filters.q,
    type: filters.type,
    status: filters.status,
    from: filters.from ? new Date(filters.from) : undefined,
    to: filters.to ? new Date(`${filters.to}T23:59:59.999Z`) : undefined,
  };
  const [rows, total] = await Promise.all([
    listAssignments({ ...query, ...toSkipTake(pagination) }),
    countAssignments(query),
  ]);
  return {
    items: rows.map(toActivityAssignmentSummary),
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
}

export type AssignmentListFilters = Pick<
  ActivityAssignmentFilters,
  "q" | "type" | "status" | "assigneeId" | "from" | "to"
>;

// One page of the viewer's assignments — the Assignment table: one row per
// assignment, scoped to the manager's downstream team (ADMIN: all).
export async function getAssignmentsPageForViewer(
  session: ScopeSession,
  pagination: PaginationParams,
  filters: AssignmentListFilters = {},
): Promise<PagedResult<ActivityAssignmentSummary>> {
  const scope = await getUserScope(session);
  const query: ActivityAssignmentQuery = {
    scopeUserIds: scopeUserIds(scope),
    q: filters.q,
    type: filters.type,
    status: filters.status,
    assigneeId: filters.assigneeId,
    from: filters.from ? new Date(filters.from) : undefined,
    to: filters.to ? new Date(`${filters.to}T23:59:59.999Z`) : undefined,
  };
  const [rows, total] = await Promise.all([
    listAssignments({ ...query, ...toSkipTake(pagination) }),
    countAssignments(query),
  ]);
  return {
    items: rows.map(toActivityAssignmentSummary),
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
}

// Who a manager can pick to assign to: active users inside their scope
// (themselves and their downstream team) — the same set createAssignment
// accepts, so the picker never offers someone the server would then reject.
export async function listAssignableUsers(
  session: ScopeSession,
): Promise<{ id: string; label: string }[]> {
  const scope = await getUserScope(session);
  const users = await findAllUsersInScope(scopeUserIds(scope));
  return users
    .filter((user) => user.status === "ACTIVE")
    .map((user) => ({ id: user.id, label: `${user.name} (${user.role.name})` }));
}

export async function getAssigneeFilterLabel(
  userId: string,
  actorId: string,
  session: ScopeSession,
): Promise<string | null> {
  const scope = await getUserScope(session);
  if (!isWithinScope(scope, userId)) return null;
  const user = await findUserById(userId);
  return user ? user.name : null;
}

// --- Type-ahead search for the Assignment screen's two dropdowns ----------

export type ActivitySearchResult = {
  id: string;
  name: string;
  type: string;
  assignmentCount: number;
};

// Activities the actor may assign to someone — their own and their team's
// (ADMIN: any), matched on name. Not narrowed to "unassigned only": more
// than one person can be assigned to the same activity at once.
export async function searchActivitiesForActor(
  query: ActivitySearchQuery,
  session: ScopeSession,
): Promise<ActivitySearchResult[]> {
  const { assignedScopeUserIds, unassignedCreatorIds } = await viewerVisibility(session, true);
  return searchActivities({
    scopeUserIds: assignedScopeUserIds,
    unassignedCreatorIds,
    q: query.q,
    limit: query.limit,
  });
}

export type ActivityAssigneeResult = {
  id: string;
  name: string;
  employeeCode: string;
  roleName: string;
};

// Users the actor may assign to: themselves and their downstream team
// (ADMIN: any active user) — the same reach assertAssigneeInScope enforces.
export async function searchAssigneesForActor(
  query: ActivityAssigneeSearchQuery,
  actorId: string,
  actorRoleName: string,
): Promise<ActivityAssigneeResult[]> {
  const ids =
    actorRoleName === "ADMIN" ? undefined : [actorId, ...(await getDownstreamUserIds(actorId))];
  const users = await searchActiveUsers({ ids, q: query.q, limit: query.limit });
  return users.map((user) => ({
    id: user.id,
    name: user.name,
    employeeCode: user.employeeCode,
    roleName: user.role.name,
  }));
}
