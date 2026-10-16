import { type PagedResult, toSkipTake } from "@/lib/pagination";
import {
  type AssigneeSearchQuery,
  type CenterSearchQuery,
  type ContactSearchQuery,
  type RouteContactIssue,
  type RouteFilters,
  type RouteListParams,
  type RouteSearchQuery,
  type RouteSelectionInput,
  type RouteStatus,
} from "@/lib/schemas/route";
import { formatTerritoryPath } from "@/lib/territory-path";
import {
  currentAndUpcomingWeeks,
  type DateRange,
  parseDateOnly,
  rangesOverlap,
  todayInKinshasa,
} from "@/lib/week";
import {
  findCenterById,
  searchActiveCentersInTerritories,
} from "@/server/repositories/center-repository";
import {
  findCenterContactLinks,
  searchContactsForCenter,
} from "@/server/repositories/contact-repository";
import {
  cancelAssignmentRow,
  createAssignmentRow,
  createRouteItem,
  createRouteItemContacts,
  createRouteRow,
  type Db,
  deleteAllRouteItemContacts,
  deleteRouteItem,
  deleteRouteItemContacts,
  findActiveAssignmentsForRoute,
  findActiveAssignmentsForVisitor,
  findActiveAssignmentsForVisitorOverlapping,
  findActiveCenterIdsForVisitorInRange,
  findAssignmentById,
  findAssignmentsPage,
  findContactExecutionStatus,
  findEditableRoutesPage,
  findRouteById,
  findRouteItemById,
  findRouteItemContactById,
  listContactStatusesForItem,
  listPendingContactIdsForItem,
  listPendingExecutionTargetsForAssignment,
  type RouteAssignmentWithRoute,
  type RouteItemStatusValue,
  type RouteWithItems,
  runInTransaction,
  searchAssignableRoutes,
  updateRouteItemSequence,
  upsertContactExecution,
  upsertItemExecution,
} from "@/server/repositories/route-repository";
import { listAssignmentsForUser } from "@/server/repositories/territory-assignment-repository";
import {
  findUserById,
  findUsersByIds,
  searchActiveUsers,
} from "@/server/repositories/user-repository";
import { getDownstreamUserIds } from "@/server/scope";

export class RouteEditCutoffError extends Error {
  constructor() {
    super("This route's date has already started, so it can no longer be edited.");
    this.name = "RouteEditCutoffError";
  }
}

export class CenterOutsideTerritoryError extends Error {
  constructor() {
    super("One or more centers are outside the visitor's permitted territories.");
    this.name = "CenterOutsideTerritoryError";
  }
}

export class DuplicateCenterOnRouteError extends Error {
  constructor() {
    super("This center is already planned for this visitor on this date.");
    this.name = "DuplicateCenterOnRouteError";
  }
}

// Thrown by content actions (add/remove/reorder) and by cancelling an
// assignment — the actor must be the route's creator, a holder of an active
// assignment on it (for item-level actions), or an ADMIN/MANAGER/SUPERVISOR
// with the relevant assignee in their downstream chain.
export class RouteNotAuthorizedError extends Error {
  constructor() {
    super("You can only act on your own route, or a route for someone in your downstream team.");
    this.name = "RouteNotAuthorizedError";
  }
}

// completeRouteItem specifically — only the assignment's own holder, never
// an assignor, not even ADMIN.
export class RouteNotOwnedError extends Error {
  constructor() {
    super("Only the assigned visitor can mark a visit completed.");
    this.name = "RouteNotOwnedError";
  }
}

export class CenterNotFoundError extends Error {
  constructor() {
    super("Center not found.");
    this.name = "CenterNotFoundError";
  }
}

// Whole-route reassign is only offered while every item is still PENDING for
// that assignment — once anything's been completed, that history can't move
// with it.
export class RouteHasCompletedItemsError extends Error {
  constructor() {
    super("This route already has completed visits, so it can no longer be reassigned as a whole.");
    this.name = "RouteHasCompletedItemsError";
  }
}

export class CenterAlreadyOnRouteError extends Error {
  constructor() {
    super("A center can only be on a route once, and this one is already on it.");
    this.name = "CenterAlreadyOnRouteError";
  }
}

export class InactiveCenterError extends Error {
  constructor() {
    super("One or more selected centers are inactive.");
    this.name = "InactiveCenterError";
  }
}

// Every selected Contact must currently be linked to the exact Center it
// was selected under, and be active — checked against ContactCenter on the
// server, never taken from the client's grouping.
export class InvalidCenterContactError extends Error {
  constructor(count: number) {
    super(
      `${count} selected contact${count === 1 ? " is" : "s are"} no longer associated with (or inactive for) their center. Remove or replace ${count === 1 ? "it" : "them"} before saving.`,
    );
    this.name = "InvalidCenterContactError";
  }
}

export class ContactAlreadyOnRouteError extends Error {
  constructor() {
    super("A contact you selected is already on this center's visit with a final status.");
    this.name = "ContactAlreadyOnRouteError";
  }
}

// A Center's status is derived from its Contacts once it has any — it can
// never be completed directly.
export class CenterStatusDerivedError extends Error {
  constructor() {
    super("This center has contacts, so it completes automatically once its contacts are done.");
    this.name = "CenterStatusDerivedError";
  }
}

export class RouteItemHasCompletedContactsError extends Error {
  constructor() {
    super("A center with a completed contact can't be removed from the route.");
    this.name = "RouteItemHasCompletedContactsError";
  }
}

export class ContactStatusConflictError extends Error {
  constructor() {
    super("This contact's visit already has a final status and can't be changed.");
    this.name = "ContactStatusConflictError";
  }
}

export class RouteAlreadyAssignedToUserError extends Error {
  constructor() {
    super("This person already has an active assignment on this route.");
    this.name = "RouteAlreadyAssignedToUserError";
  }
}

export class RouteHasNothingToAssignError extends Error {
  constructor() {
    super("This route has no visits to assign.");
    this.name = "RouteHasNothingToAssignError";
  }
}

export class InvalidDateRangeError extends Error {
  constructor() {
    super("The end date can't be before the start date.");
    this.name = "InvalidDateRangeError";
  }
}

export class RouteStartInPastError extends Error {
  constructor() {
    super("The start date can't be earlier than today.");
    this.name = "RouteStartInPastError";
  }
}

export class AssignmentNotFoundError extends Error {
  constructor() {
    super("Assignment not found.");
    this.name = "AssignmentNotFoundError";
  }
}

export class AssignmentNotActiveError extends Error {
  constructor() {
    super("This assignment is no longer active.");
    this.name = "AssignmentNotActiveError";
  }
}

// The target must exist and be active; reach (self or downstream team) is a
// separate check that throws RouteNotAuthorizedError.
export class AssigneeNotAssignableError extends Error {
  constructor() {
    super("The selected user can't be assigned routes (not found or inactive).");
    this.name = "AssigneeNotAssignableError";
  }
}

const ASSIGN_CAPABLE_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

// Authorization for content-level actions on a route as a whole (save
// content, reorder): the route's creator, anyone who holds an active
// assignment on it, or anyone with assign-team capability who has at least
// one of its active assignees in their downstream chain. ADMIN always
// passes.
async function assertCanActOnRouteContent(
  route: { createdBy: string | null },
  activeAssigneeIds: string[],
  actorId: string,
  actorRoleName: string,
): Promise<void> {
  if (actorRoleName === "ADMIN") return;
  if (route.createdBy === actorId) return;
  if (activeAssigneeIds.includes(actorId)) return;

  if (activeAssigneeIds.length === 0) throw new RouteNotAuthorizedError();
  if (!ASSIGN_CAPABLE_ROLES.has(actorRoleName)) throw new RouteNotAuthorizedError();

  const downstream = await getDownstreamUserIds(actorId);
  if (!activeAssigneeIds.some((id) => downstream.includes(id))) throw new RouteNotAuthorizedError();
}

// Authorization for acting on one specific assignment (complete/cancel item,
// reassign, cancel assignment): that assignment's own holder, or anyone
// with assign-team capability who has the holder in their downstream chain.
// ADMIN always passes.
async function assertCanActOnAssignment(
  assignment: { userId: string },
  actorId: string,
  actorRoleName: string,
): Promise<void> {
  if (actorRoleName === "ADMIN") return;
  if (assignment.userId === actorId) return;
  if (!ASSIGN_CAPABLE_ROLES.has(actorRoleName)) throw new RouteNotAuthorizedError();

  const downstream = await getDownstreamUserIds(actorId);
  if (!downstream.includes(assignment.userId)) throw new RouteNotAuthorizedError();
}

// Why a selected Contact is flagged on screen: the Contact<->Center link
// was removed since the route was saved, or the Contact has gone inactive.
// History is kept either way; the editor refuses to save a pending one
// until it's removed or replaced.

export type RouteItemContactSummary = {
  id: string;
  contactId: string;
  name: string;
  code: string;
  // The Contact's specialization at this Center (from the Contact–Center
  // link) — null when there's no link any more.
  specialization: string | null;
  // PENDING/COMPLETED/CANCELLED as actually stored for this assignment;
  // MISSED is computed.
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "MISSED";
  issue: RouteContactIssue | null;
};

export type RouteItemSummary = {
  id: string;
  sequence: number;
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "MISSED";
  center: {
    id: string;
    name: string;
    code: string;
    territoryId: string | null;
    typeName: string;
    // "Province › Ville › …" of the Center's Territory ("" when it has none).
    territoryPath: string;
  };
  contacts: RouteItemContactSummary[];
};

// One route as seen from one assignment's perspective (or, when
// assignmentId is null, unassigned — nothing has ever been assigned to this
// route, so every item is trivially PENDING). A route with several
// concurrently ACTIVE assignments produces one RouteGroupSummary per
// assignment, same id/code, different assignmentId/userId/items progress —
// deliberately: each assignee's own progress is independent.
export type RouteGroupSummary = {
  id: string;
  assignmentId: string | null;
  code: string;
  userId: string | null;
  visitorName: string | null;
  startDate: Date | null;
  endDate: Date | null;
  // Derived, never stored — see deriveRouteStatus.
  status: RouteStatus;
  editable: boolean;
  createdBy: string | null;
  createdByName: string | null;
  items: RouteItemSummary[];
};

// A route with no assignment yet is always editable — there's nothing for a
// cutoff to be relative to. Once an active assignment exists, it's editable
// while today (Kinshasa) is strictly before the *earliest* active
// assignment's start date — once anyone has begun working it, content is
// frozen for everyone.
function isRouteEditableForAssignments(
  activeAssignments: ReadonlyArray<{ startDate: Date | null }>,
  now: Date = new Date(),
): boolean {
  const starts = activeAssignments.map((a) => a.startDate).filter((d): d is Date => d !== null);
  if (starts.length === 0) return true;
  const earliest = Math.min(...starts.map((d) => d.getTime()));
  return todayInKinshasa(now).getTime() < earliest;
}

// PENDING past the end of the assignment reads as MISSED (computed, not
// stored — the same "computed, not stored" choice as attendance's ABSENT).
function itemDisplayStatus(
  status: RouteItemStatusValue,
  endDate: Date | null,
  now: Date,
): RouteItemSummary["status"] {
  if (status !== "PENDING" || !endDate) return status;
  return endDate.getTime() < todayInKinshasa(now).getTime() ? "MISSED" : "PENDING";
}

// The assignment's status as shown on the Assign Routes table and Home.
// Derived from the assignment and its items' per-assignment statuses; the
// repository's assignmentStatusWhere mirrors these rules for server-side
// filtering.
//   no assignment                               -> UNASSIGNED
//   assignment cancelled                        -> CANCELLED
//   something pending, range already over        -> MISSED
//   something pending and something completed    -> IN_PROGRESS
//   something pending                            -> ASSIGNED
//   nothing pending, something completed         -> COMPLETED
//   nothing pending, nothing completed           -> CANCELLED
//   assigned with no items at all                -> ASSIGNED
export function deriveRouteStatus(
  assignment: {
    userId: string | null;
    status: "ACTIVE" | "CANCELLED" | null;
    endDate: Date | null;
  },
  itemStatuses: ReadonlyArray<RouteItemStatusValue>,
  now: Date = new Date(),
): RouteStatus {
  if (assignment.userId === null) return "UNASSIGNED";
  if (assignment.status === "CANCELLED") return "CANCELLED";
  if (itemStatuses.length === 0) return "ASSIGNED";

  const hasPending = itemStatuses.includes("PENDING");
  const hasCompleted = itemStatuses.includes("COMPLETED");
  if (hasPending) {
    if (assignment.endDate && assignment.endDate.getTime() < todayInKinshasa(now).getTime()) {
      return "MISSED";
    }
    return hasCompleted ? "IN_PROGRESS" : "ASSIGNED";
  }
  return hasCompleted ? "COMPLETED" : "CANCELLED";
}

// A Center that has Contacts takes its status from them: any PENDING
// Contact keeps it PENDING (a MISSED Contact is just a PENDING one past its
// date — it can still be completed late, so it is not terminal); once none
// are PENDING it is COMPLETED if at least one was completed, else
// CANCELLED. A Center with no Contacts has no derived status (null) — it is
// managed manually, exactly as before Contacts existed.
export function deriveCenterStatus(
  contactStatuses: ReadonlyArray<RouteItemStatusValue>,
): RouteItemStatusValue | null {
  if (contactStatuses.length === 0) return null;
  if (contactStatuses.includes("PENDING")) return "PENDING";
  return contactStatuses.includes("COMPLETED") ? "COMPLETED" : "CANCELLED";
}

// Re-derives and stores (for one assignment) a Center's status from its
// Contacts. Called inside the same transaction as every Contact change, so
// a Center can never contradict its Contacts, for that assignment.
async function syncCenterStatus(
  routeItemId: string,
  routeAssignmentId: string,
  actorId: string,
  db: Db,
): Promise<void> {
  const derived = deriveCenterStatus(
    await listContactStatusesForItem(routeItemId, routeAssignmentId, db),
  );
  if (derived) await upsertItemExecution(routeItemId, routeAssignmentId, derived, actorId, db);
}

// Merges a set of per-assignment execution rows for one item/contact into a
// single informational status for the content-only lists (Plan Routes / Add
// Routes), which show a route independent of any one assignee: COMPLETED if
// any assignment completed it, CANCELLED if every assignment that touched
// it cancelled it, else PENDING (including "nobody has touched it yet").
function mergedStatus(
  executions: ReadonlyArray<{ status: RouteItemStatusValue }>,
): RouteItemStatusValue {
  if (executions.length === 0) return "PENDING";
  if (executions.some((e) => e.status === "COMPLETED")) return "COMPLETED";
  if (executions.every((e) => e.status === "CANCELLED")) return "CANCELLED";
  return "PENDING";
}

async function toContentSummaries(routes: RouteWithItems[]): Promise<RouteGroupSummary[]> {
  const nameIds = [
    ...new Set(routes.map((r) => r.createdBy).filter((id): id is string => id !== null)),
  ];
  const users = nameIds.length > 0 ? await findUsersByIds(nameIds) : [];
  const nameById = new Map(users.map((user) => [user.id, user.name]));

  const allItems = routes.flatMap((route) => route.items);
  const centerIds = [...new Set(allItems.map((item) => item.center.id))];
  const contactIds = [
    ...new Set(allItems.flatMap((item) => item.contacts.map((row) => row.contactId))),
  ];
  const links = contactIds.length > 0 ? await findCenterContactLinks(centerIds, contactIds) : [];
  const specializationByPair = new Map(
    links.map((link) => [`${link.centerId}:${link.contactId}`, link.specialization.name]),
  );

  return routes.map((route) => ({
    id: route.id,
    assignmentId: null,
    userId: null,
    visitorName: null,
    code: route.code,
    startDate: null,
    endDate: null,
    status: "UNASSIGNED" as const,
    editable: true,
    createdBy: route.createdBy,
    createdByName: route.createdBy ? (nameById.get(route.createdBy) ?? null) : null,
    items: route.items.map((item) => ({
      id: item.id,
      sequence: item.sequence,
      status: mergedStatus(item.executions),
      center: {
        id: item.center.id,
        name: item.center.name,
        code: item.center.code,
        territoryId: item.center.territoryId,
        typeName: item.center.type.name,
        territoryPath: formatTerritoryPath(item.center.territory),
      },
      contacts: item.contacts.map((row) => ({
        id: row.id,
        contactId: row.contactId,
        name: row.contact.name,
        code: row.contact.code,
        specialization: specializationByPair.get(`${item.center.id}:${row.contactId}`) ?? null,
        status: mergedStatus(row.executions),
        issue: !specializationByPair.has(`${item.center.id}:${row.contactId}`)
          ? ("NOT_ASSOCIATED" as const)
          : row.contact.status === "INACTIVE"
            ? ("INACTIVE" as const)
            : null,
      })),
    })),
  }));
}

async function toAssignmentSummaries(
  assignments: RouteAssignmentWithRoute[],
  now: Date = new Date(),
): Promise<RouteGroupSummary[]> {
  const nameIds = [
    ...new Set(
      assignments
        .flatMap((a) => [a.userId, a.route.createdBy])
        .filter((id): id is string => id !== null),
    ),
  ];
  const users = nameIds.length > 0 ? await findUsersByIds(nameIds) : [];
  const nameById = new Map(users.map((user) => [user.id, user.name]));

  const allItems = assignments.flatMap((a) => a.route.items);
  const centerIds = [...new Set(allItems.map((item) => item.center.id))];
  const contactIds = [
    ...new Set(allItems.flatMap((item) => item.contacts.map((row) => row.contactId))),
  ];
  const links = contactIds.length > 0 ? await findCenterContactLinks(centerIds, contactIds) : [];
  const specializationByPair = new Map(
    links.map((link) => [`${link.centerId}:${link.contactId}`, link.specialization.name]),
  );

  return assignments.map((assignment) => {
    const itemStatusById = new Map(assignment.itemExecutions.map((e) => [e.routeItemId, e.status]));
    const contactStatusById = new Map(
      assignment.contactExecutions.map((e) => [e.routeItemContactId, e.status]),
    );
    const itemStatuses = assignment.route.items.map((item) =>
      item.contacts.length > 0
        ? (deriveCenterStatus(
            item.contacts.map((row) => contactStatusById.get(row.id) ?? "PENDING"),
          ) ?? "PENDING")
        : (itemStatusById.get(item.id) ?? "PENDING"),
    );

    return {
      id: assignment.route.id,
      assignmentId: assignment.id,
      userId: assignment.userId,
      visitorName: nameById.get(assignment.userId) ?? null,
      code: assignment.route.code,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      status: deriveRouteStatus(assignment, itemStatuses, now),
      editable: isRouteEditableForAssignments(
        assignment.status === "ACTIVE" ? [assignment] : [],
        now,
      ),
      createdBy: assignment.route.createdBy,
      createdByName: assignment.route.createdBy
        ? (nameById.get(assignment.route.createdBy) ?? null)
        : null,
      items: assignment.route.items.map((item) => ({
        id: item.id,
        sequence: item.sequence,
        status: itemDisplayStatus(
          itemStatusById.get(item.id) ?? "PENDING",
          assignment.endDate,
          now,
        ),
        center: {
          id: item.center.id,
          name: item.center.name,
          code: item.center.code,
          territoryId: item.center.territoryId,
          typeName: item.center.type.name,
          territoryPath: formatTerritoryPath(item.center.territory),
        },
        contacts: item.contacts.map((row) => ({
          id: row.id,
          contactId: row.contactId,
          name: row.contact.name,
          code: row.contact.code,
          specialization: specializationByPair.get(`${item.center.id}:${row.contactId}`) ?? null,
          status: itemDisplayStatus(
            contactStatusById.get(row.id) ?? "PENDING",
            assignment.endDate,
            now,
          ),
          issue: !specializationByPair.has(`${item.center.id}:${row.contactId}`)
            ? ("NOT_ASSOCIATED" as const)
            : row.contact.status === "INACTIVE"
              ? ("INACTIVE" as const)
              : null,
        })),
      })),
    };
  });
}

// The visitor's (or creator's, while unassigned) permitted territories —
// home territory plus every UserTerritoryAssignment row (S2-04's
// multi-territory model).
export async function getPermittedTerritoryIds(userId: string): Promise<Set<string>> {
  const [user, assignments] = await Promise.all([
    findUserById(userId),
    listAssignmentsForUser(userId),
  ]);
  const ids = new Set<string>(assignments.map((assignment) => assignment.territoryId));
  if (user?.territoryId) ids.add(user.territoryId);
  return ids;
}

// Whose assigned routes the actor's lists may show: their own and everyone
// downstream of them (ADMIN: anyone's — undefined means "no restriction").
async function assignedScopeUserIds(
  actorId: string,
  actorRoleName: string,
): Promise<string[] | undefined> {
  if (actorRoleName === "ADMIN") return undefined;
  return [actorId, ...(await getDownstreamUserIds(actorId))];
}

// Add Routes list — content-only, every route within the actor's reach
// regardless of how many (if any) active assignments it carries. Same scope
// as the Assign Routes table.
export async function listRoutesForContent(
  params: RouteListParams,
  actorId: string,
  actorRoleName: string,
): Promise<PagedResult<RouteGroupSummary>> {
  const assignedUserIds = await assignedScopeUserIds(actorId, actorRoleName);
  const { routes, total } = await findEditableRoutesPage({
    scope: { creatorId: actorId, assignedUserIds },
    filters: {
      q: params.q || undefined,
      assigneeId: params.assigneeId,
      from: params.from ? parseDateOnly(params.from) : undefined,
      to: params.to ? parseDateOnly(params.to) : undefined,
    },
    ...toSkipTake(params),
  });
  return {
    items: await toContentSummaries(routes),
    total,
    page: params.page,
    pageSize: params.pageSize,
  };
}

// Assign Routes table — one row per assignment (a route with two concurrent
// assignees appears twice), scoped to the actor's downstream chain (ADMIN:
// all), filtered and paginated on the server.
export async function listRoutesForAssignment(
  filters: RouteFilters,
  actorId: string,
  actorRoleName: string,
): Promise<PagedResult<RouteGroupSummary>> {
  const assignedUserIds = await assignedScopeUserIds(actorId, actorRoleName);
  const now = new Date();
  const { assignments, total } = await findAssignmentsPage({
    scope: { creatorId: actorId, assignedUserIds },
    filters: {
      q: filters.q || undefined,
      assigneeId: filters.assigneeId,
      status: filters.status,
      from: filters.from ? parseDateOnly(filters.from) : undefined,
      to: filters.to ? parseDateOnly(filters.to) : undefined,
    },
    today: todayInKinshasa(now),
    ...toSkipTake(filters),
  });
  return {
    items: await toAssignmentSummaries(assignments, now),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

// One route for its content-management page (Plan Routes). Authorized for
// anyone who can act on its content; "not found" and "not yours" are
// indistinguishable (null).
export async function getRouteForManagement(
  routeId: string,
  actorId: string,
  actorRoleName: string,
): Promise<RouteGroupSummary | null> {
  const route = await findRouteById(routeId);
  if (!route) return null;
  const activeAssignments = await findActiveAssignmentsForRoute(routeId);
  try {
    await assertCanActOnRouteContent(
      route,
      activeAssignments.map((a) => a.userId),
      actorId,
      actorRoleName,
    );
  } catch (error) {
    if (error instanceof RouteNotAuthorizedError) return null;
    throw error;
  }
  const [summary] = await toContentSummaries([route]);
  return summary ?? null;
}

// One assignment for its own management page (Assign Routes row detail —
// reassign/cancel live here, scoped to this one assignment alone).
export async function getAssignmentForManagement(
  assignmentId: string,
  actorId: string,
  actorRoleName: string,
): Promise<RouteGroupSummary | null> {
  const assignment = await findAssignmentById(assignmentId);
  if (!assignment) return null;
  try {
    await assertCanActOnAssignment(assignment, actorId, actorRoleName);
  } catch (error) {
    if (error instanceof RouteNotAuthorizedError) return null;
    throw error;
  }
  const [summary] = await toAssignmentSummaries([assignment]);
  return summary ?? null;
}

// Visits — every ACTIVE assignment currently held by this visitor,
// regardless of who created or assigned the underlying route. A visitor
// holding two concurrent assignments (possibly even on the same route) sees
// both as separate rows, each with their own progress.
export async function getMyVisits(visitorId: string): Promise<RouteGroupSummary[]> {
  const assignments = await findActiveAssignmentsForVisitor(visitorId);
  return toAssignmentSummaries(assignments);
}

export type HomeRoutes = {
  thisWeek: { range: DateRange; routes: RouteGroupSummary[] };
  upcomingWeek: { range: DateRange; routes: RouteGroupSummary[] };
};

// Home's "My Routes" — only the signed-in user's own ACTIVE assignments,
// split into This Week and Upcoming Week (Monday–Sunday, Africa/Kinshasa) by
// *overlap* with each assignment's range. An assignment spanning both weeks
// is one row that simply appears in both sections, whole — never split or
// duplicated.
export async function getMyRoutesForHome(
  userId: string,
  now: Date = new Date(),
): Promise<HomeRoutes> {
  const { thisWeek, upcomingWeek } = currentAndUpcomingWeeks(now);
  const rows = await findActiveAssignmentsForVisitorOverlapping(
    userId,
    thisWeek.start,
    upcomingWeek.end,
  );
  const active = await toAssignmentSummaries(rows, now);

  const inWeek = (week: DateRange) =>
    active.filter(
      (route) =>
        route.startDate !== null &&
        route.endDate !== null &&
        rangesOverlap({ start: route.startDate, end: route.endDate }, week),
    );
  return {
    thisWeek: { range: thisWeek, routes: inWeek(thisWeek) },
    upcomingWeek: { range: upcomingWeek, routes: inWeek(upcomingWeek) },
  };
}

export async function reorderRouteItems(
  routeId: string,
  orderedRouteItemIds: string[],
  actorId: string,
  actorRoleName: string,
): Promise<void> {
  const route = await findRouteById(routeId);
  if (!route) return;
  const activeAssignments = await findActiveAssignmentsForRoute(routeId);
  await assertCanActOnRouteContent(
    route,
    activeAssignments.map((a) => a.userId),
    actorId,
    actorRoleName,
  );
  // Deliberately NOT gated by the edit cutoff — sequence-only, not a
  // content change; see my-visits-board.tsx / route-visits-board.tsx.

  await Promise.all(
    orderedRouteItemIds.map((itemId, index) => updateRouteItemSequence(itemId, index, actorId)),
  );
}

// The single "Save" action on the Plan Routes editor — nothing about a
// route's content is written until this runs. Takes the editor's whole
// desired list of centers (in order), each with its selected contacts, and
// diffs it against what's actually stored: centers no longer in the list
// get removed, new ones get created, everyone kept gets resequenced to
// match, and each kept center's pending contacts are added/removed to
// match. `routeId: null` covers a brand-new route — created here, in the
// same call, only once there's actually something to save. An item or
// contact that anyone has ever acted on (completed or cancelled, for any
// assignment) is never touched by the diff — only ones nobody has acted on
// are ever part of the editable set. Every check runs before the first
// write, and every write runs in one transaction, so a failure can never
// leave a half-saved route.
export async function saveRouteContent(
  routeId: string | null,
  selections: RouteSelectionInput[],
  actorId: string,
  actorRoleName: string,
): Promise<string> {
  const route = routeId ? await findRouteById(routeId) : null;
  if (routeId && !route) throw new RouteNotAuthorizedError();

  const activeAssignments = route ? await findActiveAssignmentsForRoute(route.id) : [];
  if (route) {
    await assertCanActOnRouteContent(
      route,
      activeAssignments.map((a) => a.userId),
      actorId,
      actorRoleName,
    );
    if (!isRouteEditableForAssignments(activeAssignments)) throw new RouteEditCutoffError();
  }

  const territoryOwnerId = activeAssignments[0]?.userId ?? route?.createdBy ?? actorId;
  const permittedTerritoryIds = territoryOwnerId
    ? await getPermittedTerritoryIds(territoryOwnerId)
    : new Set<string>();

  const centerIdsInOrder = selections.map((selection) => selection.centerId);
  if (new Set(centerIdsInOrder).size !== centerIdsInOrder.length) {
    throw new CenterAlreadyOnRouteError();
  }

  const untouched = (item: RouteWithItems["items"][number]) => item.executions.length === 0;
  const editableExistingItems = (route?.items ?? []).filter(untouched);
  const existingByCenterId = new Map(editableExistingItems.map((item) => [item.center.id, item]));
  // A center any assignment has already acted on is history on this route —
  // it can't be re-added (the unique (route, center) constraint would
  // reject it anyway; this gives a clear message first).
  const finalizedCenterIds = new Set(
    (route?.items ?? []).filter((item) => !untouched(item)).map((item) => item.center.id),
  );
  if (centerIdsInOrder.some((id) => finalizedCenterIds.has(id))) {
    throw new CenterAlreadyOnRouteError();
  }

  const keepCenterIds = new Set(centerIdsInOrder.filter((id) => existingByCenterId.has(id)));
  const toRemove = editableExistingItems.filter((item) => !keepCenterIds.has(item.center.id));
  const toAddCenterIds = centerIdsInOrder.filter((id) => !existingByCenterId.has(id));

  if (
    toRemove.some((item) =>
      item.contacts.some((row) => row.executions.some((e) => e.status === "COMPLETED")),
    )
  ) {
    throw new RouteItemHasCompletedContactsError();
  }

  const centersToAdd = await Promise.all(toAddCenterIds.map((id) => findCenterById(id)));
  for (const center of centersToAdd) {
    if (!center) throw new CenterNotFoundError();
    if (center.status !== "ACTIVE") throw new InactiveCenterError();
    if (!center.territoryId || !permittedTerritoryIds.has(center.territoryId)) {
      throw new CenterOutsideTerritoryError();
    }
  }

  // Duplicate-elsewhere check runs per active assignee — a center can't be
  // added here if it's already active on one of this route's assignees'
  // other routes in their overlapping range.
  for (const assignment of activeAssignments) {
    if (!assignment.startDate || !assignment.endDate) continue;
    const activeElsewhere = await findActiveCenterIdsForVisitorInRange(
      assignment.userId,
      assignment.startDate,
      assignment.endDate,
      route!.id,
    );
    if (toAddCenterIds.some((id) => activeElsewhere.has(id))) {
      throw new DuplicateCenterOnRouteError();
    }
  }

  // Contacts — plan the per-center diff first, then validate every kept or
  // new selection against ContactCenter in one query. A contact anyone has
  // already acted on can't be selected again.
  const contactPlans = selections.map((selection) => {
    const existing = existingByCenterId.get(selection.centerId);
    const existingRows = new Map((existing?.contacts ?? []).map((row) => [row.contactId, row]));
    for (const contactId of selection.contactIds) {
      const row = existingRows.get(contactId);
      if (row && row.executions.length > 0) throw new ContactAlreadyOnRouteError();
    }
    const desired = new Set(selection.contactIds);
    return {
      centerId: selection.centerId,
      existingItemId: existing?.id ?? null,
      toDelete: (existing?.contacts ?? [])
        .filter((row) => row.executions.length === 0 && !desired.has(row.contactId))
        .map((row) => row.contactId),
      toCreate: selection.contactIds.filter((contactId) => !existingRows.has(contactId)),
      selectedContactIds: selection.contactIds,
    };
  });

  const allSelectedContactIds = [...new Set(selections.flatMap((s) => s.contactIds))];
  if (allSelectedContactIds.length > 0) {
    const links = await findCenterContactLinks(centerIdsInOrder, allSelectedContactIds);
    const validPairs = new Set(
      links
        .filter((link) => link.contact.status === "ACTIVE")
        .map((l) => `${l.centerId}:${l.contactId}`),
    );
    const invalidCount = selections.reduce(
      (count, selection) =>
        count +
        selection.contactIds.filter(
          (contactId) => !validPairs.has(`${selection.centerId}:${contactId}`),
        ).length,
      0,
    );
    if (invalidCount > 0) throw new InvalidCenterContactError(invalidCount);
  }

  return runInTransaction(async (tx) => {
    const resolvedRouteId = route?.id ?? (await createRouteRow(actorId, tx)).id;

    for (const item of toRemove) {
      await deleteAllRouteItemContacts(item.id, tx);
      await deleteRouteItem(item.id, tx);
    }

    for (const [sequence, plan] of contactPlans.entries()) {
      let itemId = plan.existingItemId;
      if (itemId) {
        await updateRouteItemSequence(itemId, sequence, actorId, tx);
      } else {
        const created = await createRouteItem(
          {
            route: { connect: { id: resolvedRouteId } },
            center: { connect: { id: plan.centerId } },
            sequence,
            createdBy: actorId,
            updatedBy: actorId,
          },
          tx,
        );
        itemId = created.id;
      }

      if (plan.toDelete.length > 0) await deleteRouteItemContacts(itemId, plan.toDelete, tx);
      if (plan.toCreate.length > 0)
        await createRouteItemContacts(itemId, plan.toCreate, actorId, tx);
    }

    return resolvedRouteId;
  });
}

// Strictly the assignment's own holder — no chain exception, not even
// ADMIN. Deliberately not gated by the edit cutoff: a visit is normally
// completed on or after its own date, exactly when content editing has
// locked. A center that has contacts can't be completed directly — it
// completes when its contacts do.
export async function completeRouteItem(
  routeItemId: string,
  routeAssignmentId: string,
  actorId: string,
): Promise<void> {
  const item = await findRouteItemById(routeItemId);
  if (!item) return;
  const assignment = await findAssignmentById(routeAssignmentId);
  if (!assignment || assignment.userId !== actorId) throw new RouteNotOwnedError();
  if (assignment.status !== "ACTIVE") throw new AssignmentNotActiveError();
  if (item.contacts.length > 0) throw new CenterStatusDerivedError();

  await upsertItemExecution(routeItemId, routeAssignmentId, "COMPLETED", actorId);
}

// Visitor (for their own assignment) or anyone with assign-team capability
// in their upward chain — only ever cancels the acting assignment's own
// progress, never touching any other assignee sharing the same stop list.
// For a center with contacts, cancelling cancels its still-PENDING contacts
// (for this assignment; completed ones are untouched) and the center's
// status is then derived — so it ends COMPLETED, not CANCELLED, if any
// contact was already done.
export async function cancelRouteItem(
  routeItemId: string,
  routeAssignmentId: string,
  actorId: string,
  actorRoleName: string,
): Promise<void> {
  const item = await findRouteItemById(routeItemId);
  if (!item) return;
  const assignment = await findAssignmentById(routeAssignmentId);
  if (!assignment) return;
  await assertCanActOnAssignment(assignment, actorId, actorRoleName);

  if (item.contacts.length > 0) {
    await runInTransaction(async (tx) => {
      const pendingContactIds = await listPendingContactIdsForItem(
        routeItemId,
        routeAssignmentId,
        tx,
      );
      for (const contactId of pendingContactIds) {
        await upsertContactExecution(contactId, routeAssignmentId, "CANCELLED", actorId, tx);
      }
      await syncCenterStatus(routeItemId, routeAssignmentId, actorId, tx);
    });
    return;
  }

  await upsertItemExecution(routeItemId, routeAssignmentId, "CANCELLED", actorId);
}

// Strictly the assignment's own holder, same as completing a center.
export async function completeRouteItemContact(
  routeItemContactId: string,
  routeAssignmentId: string,
  actorId: string,
): Promise<void> {
  const row = await findRouteItemContactById(routeItemContactId);
  if (!row) return;
  const assignment = await findAssignmentById(routeAssignmentId);
  if (!assignment || assignment.userId !== actorId) throw new RouteNotOwnedError();
  if (assignment.status !== "ACTIVE") throw new AssignmentNotActiveError();

  const current = await findContactExecutionStatus(routeItemContactId, routeAssignmentId);
  if (current === "COMPLETED") return;
  if (current !== "PENDING") throw new ContactStatusConflictError();

  await runInTransaction(async (tx) => {
    await upsertContactExecution(routeItemContactId, routeAssignmentId, "COMPLETED", actorId, tx);
    await syncCenterStatus(row.routeItemId, routeAssignmentId, actorId, tx);
  });
}

// Same authorization as cancelling a center: the assignment's holder or
// anyone with the holder in their downstream chain.
export async function cancelRouteItemContact(
  routeItemContactId: string,
  routeAssignmentId: string,
  actorId: string,
  actorRoleName: string,
): Promise<void> {
  const row = await findRouteItemContactById(routeItemContactId);
  if (!row) return;
  const assignment = await findAssignmentById(routeAssignmentId);
  if (!assignment) return;
  await assertCanActOnAssignment(assignment, actorId, actorRoleName);

  const current = await findContactExecutionStatus(routeItemContactId, routeAssignmentId);
  if (current === "CANCELLED") return;
  if (current !== "PENDING") throw new ContactStatusConflictError();

  await runInTransaction(async (tx) => {
    await upsertContactExecution(routeItemContactId, routeAssignmentId, "CANCELLED", actorId, tx);
    await syncCenterStatus(row.routeItemId, routeAssignmentId, actorId, tx);
  });
}

async function assertTargetAssignable(
  targetUserId: string,
  actorId: string,
  actorRoleName: string,
): Promise<void> {
  if (actorRoleName !== "ADMIN" && actorId !== targetUserId) {
    if (!ASSIGN_CAPABLE_ROLES.has(actorRoleName)) throw new RouteNotAuthorizedError();
    const downstream = await getDownstreamUserIds(actorId);
    if (!downstream.includes(targetUserId)) throw new RouteNotAuthorizedError();
  }

  const target = await findUserById(targetUserId);
  if (!target || target.status !== "ACTIVE") throw new AssigneeNotAssignableError();
}

function assertAssignableRange(startDate: Date, endDate: Date, now: Date): void {
  if (endDate.getTime() < startDate.getTime()) throw new InvalidDateRangeError();
  if (startDate.getTime() < todayInKinshasa(now).getTime()) throw new RouteStartInPastError();
}

async function assertItemsFitTerritoryAndNoDuplicates(
  route: RouteWithItems,
  targetUserId: string,
  startDate: Date,
  endDate: Date,
): Promise<void> {
  const [permittedTerritoryIds, activeElsewhere] = await Promise.all([
    getPermittedTerritoryIds(targetUserId),
    findActiveCenterIdsForVisitorInRange(targetUserId, startDate, endDate, route.id),
  ]);

  for (const item of route.items) {
    if (!item.center.territoryId || !permittedTerritoryIds.has(item.center.territoryId)) {
      throw new CenterOutsideTerritoryError();
    }
    if (activeElsewhere.has(item.center.id)) {
      throw new DuplicateCenterOnRouteError();
    }
  }
}

// Assign this route to a new user for a date range — concurrent assignment
// is the point, so an already-assigned route is still offered; the only
// thing blocked is assigning the same person twice while they already hold
// an active assignment here.
export async function assignRoute(
  routeId: string,
  targetUserId: string,
  startDate: Date,
  endDate: Date,
  actorId: string,
  actorRoleName: string,
): Promise<string> {
  const route = await findRouteById(routeId);
  if (!route) throw new RouteNotAuthorizedError();
  const activeAssignments = await findActiveAssignmentsForRoute(routeId);
  await assertCanActOnRouteContent(
    route,
    activeAssignments.map((a) => a.userId),
    actorId,
    actorRoleName,
  );
  if (route.items.length === 0) throw new RouteHasNothingToAssignError();
  // An ACTIVE assignment never flips to any other status just because its
  // work is done — status only ever changes via explicit cancellation (see
  // the schema comment on RouteAssignment). So "already assigned" has to
  // mean "still has something pending for them here," not merely "holds a
  // non-cancelled row" — otherwise a route a person has already finished
  // could never be handed to them again.
  for (const existing of activeAssignments.filter((a) => a.userId === targetUserId)) {
    const pending = await listPendingExecutionTargetsForAssignment(routeId, existing.id);
    if (pending.itemIds.length > 0 || pending.itemsWithContactsIds.length > 0) {
      throw new RouteAlreadyAssignedToUserError();
    }
  }

  assertAssignableRange(startDate, endDate, new Date());
  await assertTargetAssignable(targetUserId, actorId, actorRoleName);
  await assertItemsFitTerritoryAndNoDuplicates(route, targetUserId, startDate, endDate);

  const created = await createAssignmentRow(
    { routeId, userId: targetUserId, startDate, endDate },
    actorId,
  );
  return created.id;
}

// Reassignment — one specific assignment moves to a different user and/or a
// different range. Cancels the current assignment row and creates a new
// one for the new holder; the route's items and their contacts are
// untouched (shared plan content). Only valid while nothing has been
// completed on this assignment — no completed center and no completed
// contact — so completed work always stays attributed to the person who
// did it.
export async function reassignRoute(
  assignmentId: string,
  targetUserId: string,
  startDate: Date,
  endDate: Date,
  actorId: string,
  actorRoleName: string,
): Promise<string> {
  const assignment = await findAssignmentById(assignmentId);
  if (!assignment) throw new AssignmentNotFoundError();
  await assertCanActOnAssignment(assignment, actorId, actorRoleName);
  if (assignment.status !== "ACTIVE") throw new AssignmentNotActiveError();

  const completedSomewhere =
    assignment.itemExecutions.some((e) => e.status === "COMPLETED") ||
    assignment.contactExecutions.some((e) => e.status === "COMPLETED");
  if (completedSomewhere) throw new RouteHasCompletedItemsError();

  assertAssignableRange(startDate, endDate, new Date());
  await assertTargetAssignable(targetUserId, actorId, actorRoleName);
  await assertItemsFitTerritoryAndNoDuplicates(assignment.route, targetUserId, startDate, endDate);

  const created = await runInTransaction(async (tx) => {
    await cancelAssignmentRow(assignmentId, actorId, tx);
    return createAssignmentRow(
      { routeId: assignment.routeId, userId: targetUserId, startDate, endDate },
      actorId,
      tx,
    );
  });
  return created.id;
}

// "Cancel the assignment" — flips this one assignment to CANCELLED and
// bulk-cancels every still-PENDING item/contact *for this assignment only*;
// any other assignee sharing the same route's stop list is untouched.
export async function cancelRouteAssignment(
  assignmentId: string,
  actorId: string,
  actorRoleName: string,
): Promise<void> {
  const assignment = await findAssignmentById(assignmentId);
  if (!assignment || assignment.status !== "ACTIVE") return;
  await assertCanActOnAssignment(assignment, actorId, actorRoleName);

  await runInTransaction(async (tx) => {
    const { itemIds, itemsWithContactsIds, contactIds } =
      await listPendingExecutionTargetsForAssignment(assignment.routeId, assignmentId, tx);
    for (const itemId of itemIds) {
      await upsertItemExecution(itemId, assignmentId, "CANCELLED", actorId, tx);
    }
    for (const contactId of contactIds) {
      await upsertContactExecution(contactId, assignmentId, "CANCELLED", actorId, tx);
    }
    for (const itemId of itemsWithContactsIds) {
      await syncCenterStatus(itemId, assignmentId, actorId, tx);
    }
    await cancelAssignmentRow(assignmentId, actorId, tx);
  });
}

// Display name for the assignee filter currently in the URL, so a reload
// still shows who is selected. Only resolves users the actor may assign to
// (themselves, their downstream team; ADMIN: anyone) — a pasted id outside
// that reach gets no name, never a lookup of arbitrary users.
export async function getAssigneeFilterLabel(
  userId: string,
  actorId: string,
  actorRoleName: string,
): Promise<string | null> {
  if (actorRoleName !== "ADMIN" && userId !== actorId) {
    const downstream = await getDownstreamUserIds(actorId);
    if (!downstream.includes(userId)) return null;
  }
  const user = await findUserById(userId);
  return user ? `${user.name} (${user.employeeCode})` : null;
}

// --- Type-ahead search for the Assign Routes form ---------------------------

export type AssignableRouteResult = {
  id: string;
  code: string;
  centerCount: number;
  contactCount: number;
  centerNames: string[];
};

// Routes the actor may assign (own, or within their downstream chain's
// reach; ADMIN: anyone's) that have at least one stop. Concurrent
// assignment means an already-assigned route is still offered.
export async function searchAssignableRoutesForActor(
  query: RouteSearchQuery,
  actorId: string,
  actorRoleName: string,
): Promise<AssignableRouteResult[]> {
  const assignedUserIds = await assignedScopeUserIds(actorId, actorRoleName);
  const rows = await searchAssignableRoutes({
    scope: { creatorId: actorId, assignedUserIds },
    q: query.q,
    limit: query.limit,
  });
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    centerCount: row.items.length,
    contactCount: row.items.reduce((sum, item) => sum + item.contacts.length, 0),
    centerNames: row.items.slice(0, 3).map((item) => item.center.name),
  }));
}

export type AssigneeResult = { id: string; name: string; employeeCode: string; roleName: string };

// Users the actor may assign to: themselves and their downstream team
// (ADMIN: any active user) — the same reach assertTargetAssignable enforces.
export async function searchAssigneesForActor(
  query: AssigneeSearchQuery,
  actorId: string,
  actorRoleName: string,
): Promise<AssigneeResult[]> {
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

// --- Type-ahead search for the Plan Routes editor ---------------------------

// The territories a search may reach: the actor's own on a brand-new route;
// the route's active-assignee's (or creator's, if unassigned) when editing
// an existing one, after the same authorization every other content action
// on that route requires.
async function resolveSearchTerritoryIds(
  routeId: string | undefined,
  actorId: string,
  actorRoleName: string,
): Promise<Set<string>> {
  if (!routeId) return getPermittedTerritoryIds(actorId);

  const route = await findRouteById(routeId);
  if (!route) throw new RouteNotAuthorizedError();
  const activeAssignments = await findActiveAssignmentsForRoute(routeId);
  await assertCanActOnRouteContent(
    route,
    activeAssignments.map((a) => a.userId),
    actorId,
    actorRoleName,
  );
  const ownerId = activeAssignments[0]?.userId ?? route.createdBy;
  return ownerId ? getPermittedTerritoryIds(ownerId) : new Set<string>();
}

export type CenterSearchResult = {
  id: string;
  name: string;
  code: string;
  territoryId: string | null;
  typeName: string;
  territoryPath: string;
};

export async function searchCentersForRoute(
  query: CenterSearchQuery,
  actorId: string,
  actorRoleName: string,
): Promise<CenterSearchResult[]> {
  const permitted = await resolveSearchTerritoryIds(query.routeId, actorId, actorRoleName);
  const territoryIds = query.territoryId
    ? permitted.has(query.territoryId)
      ? [query.territoryId]
      : []
    : [...permitted];
  if (territoryIds.length === 0) return [];

  const centers = await searchActiveCentersInTerritories({
    territoryIds,
    q: query.q,
    limit: query.limit,
  });
  return centers.map((center) => ({
    id: center.id,
    name: center.name,
    code: center.code,
    territoryId: center.territoryId,
    typeName: center.type.name,
    territoryPath: formatTerritoryPath(center.territory),
  }));
}

export type ContactSearchResult = {
  id: string;
  name: string;
  code: string;
  specialization: string | null;
};

// Only Contacts linked to this one Center, and only if the Center itself is
// active and inside the actor's reach — a center id from outside it gets the
// same error a save would.
export async function searchContactsForRouteCenter(
  centerId: string,
  query: ContactSearchQuery,
  actorId: string,
  actorRoleName: string,
): Promise<ContactSearchResult[]> {
  const permitted = await resolveSearchTerritoryIds(query.routeId, actorId, actorRoleName);
  const center = await findCenterById(centerId);
  if (!center) throw new CenterNotFoundError();
  if (center.status !== "ACTIVE") throw new InactiveCenterError();
  if (!center.territoryId || !permitted.has(center.territoryId)) {
    throw new CenterOutsideTerritoryError();
  }

  const rows = await searchContactsForCenter({ centerId, q: query.q, limit: query.limit });
  return rows.map((row) => ({
    id: row.contact.id,
    name: row.contact.name,
    code: row.contact.code,
    specialization: row.specialization.name,
  }));
}
