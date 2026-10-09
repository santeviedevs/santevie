import { isRouteEditable } from "@/lib/schemas/route";
import { findCenterById } from "@/server/repositories/center-repository";
import {
  assignRouteRow,
  cancelPendingRouteItems,
  createRouteItem,
  createRouteRow,
  deleteRouteItem,
  deleteRouteRow,
  findActiveCenterIdsForVisitorOnDate,
  findAssignableRoutes,
  findEditableRoutes,
  findRouteById,
  findRouteItemById,
  findRoutesForVisitor,
  moveRouteItems,
  type RouteWithItems,
  updateRouteItemSequence,
  updateRouteItemStatus,
} from "@/server/repositories/route-repository";
import { listAssignmentsForUser } from "@/server/repositories/territory-assignment-repository";
import { findUserById, findUsersByIds } from "@/server/repositories/user-repository";
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
// assignment — the actor must be the route's creator (while unassigned), the
// visitor themselves (once assigned), or an ADMIN/MANAGER/SUPERVISOR with
// the visitor in their downstream chain.
export class RouteNotAuthorizedError extends Error {
  constructor() {
    super("You can only act on your own route, or a route for someone in your downstream team.");
    this.name = "RouteNotAuthorizedError";
  }
}

// completeRouteItem specifically — only the visitor themselves, never an
// assignor, not even ADMIN.
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

// Whole-route reassign is only offered while every item is still PENDING —
// once anything's been completed, that history can't move with it.
export class RouteHasCompletedItemsError extends Error {
  constructor() {
    super("This route already has completed visits, so it can no longer be reassigned as a whole.");
    this.name = "RouteHasCompletedItemsError";
  }
}

const ASSIGN_CAPABLE_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

// The one authorization rule for every content-level and assignment-level
// action: the route's creator (only meaningful while it's still
// unassigned), the visitor themselves (once assigned), or anyone with
// assign-team capability who has the visitor in their downstream chain.
// ADMIN always passes.
async function assertCanActOnRoute(
  route: { userId: string | null; createdBy: string | null },
  actorId: string,
  actorRoleName: string,
): Promise<void> {
  if (actorRoleName === "ADMIN") return;

  if (route.userId === null) {
    if (route.createdBy === actorId) return;
    throw new RouteNotAuthorizedError();
  }

  if (route.userId === actorId) return;
  if (!ASSIGN_CAPABLE_ROLES.has(actorRoleName)) throw new RouteNotAuthorizedError();

  const downstream = await getDownstreamUserIds(actorId);
  if (!downstream.includes(route.userId)) throw new RouteNotAuthorizedError();
}

export type RouteItemSummary = {
  id: string;
  sequence: number;
  // PENDING/COMPLETED/CANCELLED as actually stored; MISSED is never
  // stored — see the RouteItemStatus enum comment in schema.prisma.
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "MISSED";
  center: { id: string; name: string; code: string; territoryId: string | null };
};

export type RouteGroupSummary = {
  id: string;
  userId: string | null;
  visitorName: string | null;
  date: Date | null;
  editable: boolean;
  createdBy: string | null;
  createdByName: string | null;
  items: RouteItemSummary[];
};

function itemDisplayStatus(
  status: "PENDING" | "COMPLETED" | "CANCELLED",
  date: Date | null,
): RouteItemSummary["status"] {
  if (status !== "PENDING" || !date) return status;
  const now = new Date();
  const todayUtcMidnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  return date.getTime() < todayUtcMidnight.getTime() ? "MISSED" : "PENDING";
}

async function toGroupSummaries(routes: RouteWithItems[]): Promise<RouteGroupSummary[]> {
  const nameIds = [
    ...new Set(
      routes
        .flatMap((route) => [route.userId, route.createdBy])
        .filter((id): id is string => id !== null),
    ),
  ];
  const users = nameIds.length > 0 ? await findUsersByIds(nameIds) : [];
  const nameById = new Map(users.map((user) => [user.id, user.name]));

  return routes.map((route) => ({
    id: route.id,
    userId: route.userId,
    visitorName: route.userId ? (nameById.get(route.userId) ?? null) : null,
    date: route.date,
    editable: isRouteEditable(route.date),
    createdBy: route.createdBy,
    createdByName: route.createdBy ? (nameById.get(route.createdBy) ?? null) : null,
    items: route.items.map((item) => ({
      id: item.id,
      sequence: item.sequence,
      status: itemDisplayStatus(item.status, route.date),
      center: {
        id: item.center.id,
        name: item.center.name,
        code: item.center.code,
        territoryId: item.center.territoryId,
      },
    })),
  }));
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

// Route Visits (content) — the actor's own unassigned drafts, plus any
// route already assigned within their downstream chain.
export async function getRoutesForContent(
  actorId: string,
  actorRoleName: string,
): Promise<RouteGroupSummary[]> {
  const assignedUserIds =
    actorRoleName === "ADMIN" ? undefined : await getDownstreamUserIds(actorId);
  const routes = await findEditableRoutes({ creatorId: actorId, assignedUserIds });
  return toGroupSummaries(routes);
}

// Assignment — identical reach as Route Visits (same authorization
// boundary governs both content edits and assign/reassign/cancel).
export async function getRoutesForAssignment(
  actorId: string,
  actorRoleName: string,
): Promise<RouteGroupSummary[]> {
  const assignedUserIds =
    actorRoleName === "ADMIN" ? undefined : await getDownstreamUserIds(actorId);
  const routes = await findAssignableRoutes({ creatorId: actorId, assignedUserIds });
  return toGroupSummaries(routes);
}

// My Visits — every route currently assigned to this visitor, regardless of
// who created or assigned it.
export async function getMyVisits(visitorId: string): Promise<RouteGroupSummary[]> {
  const routes = await findRoutesForVisitor(visitorId);
  return toGroupSummaries(routes);
}

export async function listAssignableUsers(
  actorId: string,
): Promise<{ id: string; name: string }[]> {
  const downstream = await getDownstreamUserIds(actorId);
  const users = await findUsersByIds([actorId, ...downstream]);
  return users.sort((a, b) =>
    a.id === actorId ? -1 : b.id === actorId ? 1 : a.name.localeCompare(b.name),
  );
}

export async function reorderRouteItems(
  routeId: string,
  orderedRouteItemIds: string[],
  actorId: string,
  actorRoleName: string,
): Promise<void> {
  const route = await findRouteById(routeId);
  if (!route) return;
  await assertCanActOnRoute(route, actorId, actorRoleName);
  // Deliberately NOT gated by isRouteEditable — sequence-only, not a
  // content change; see my-visits-board.tsx / route-visits-board.tsx.

  await Promise.all(
    orderedRouteItemIds.map((itemId, index) => updateRouteItemSequence(itemId, index, actorId)),
  );
}

// The single "Save" action on the Route Visits editor — nothing about a
// route's content is written until this runs. Takes the editor's whole
// desired center list (in order) and diffs it against what's actually
// stored: centers no longer in the list get removed, new ones get
// created, everyone kept gets resequenced to match. `routeId: null` covers
// a brand-new route — created here, in the same call, only once there's
// actually something to save (so "New route" never leaves a bare, empty
// row sitting on Route Visits/Assignment before the user has chosen
// anything). COMPLETED/CANCELLED items are never touched by the diff —
// only PENDING/MISSED ones are ever part of the editable set.
export async function saveRouteContent(
  routeId: string | null,
  centerIdsInOrder: string[],
  actorId: string,
  actorRoleName: string,
): Promise<string> {
  const route = routeId ? await findRouteById(routeId) : null;
  if (routeId && !route) throw new RouteNotAuthorizedError();

  if (route) {
    await assertCanActOnRoute(route, actorId, actorRoleName);
    if (!isRouteEditable(route.date)) throw new RouteEditCutoffError();
  }

  const territoryOwnerId = route ? (route.userId ?? route.createdBy) : actorId;
  const permittedTerritoryIds = territoryOwnerId
    ? await getPermittedTerritoryIds(territoryOwnerId)
    : new Set<string>();

  const editableExistingItems = (route?.items ?? []).filter((item) => item.status === "PENDING");
  const existingCenterIds = new Set(editableExistingItems.map((item) => item.center.id));
  const keepCenterIds = new Set(centerIdsInOrder.filter((id) => existingCenterIds.has(id)));
  const toRemove = editableExistingItems.filter((item) => !keepCenterIds.has(item.center.id));
  const toAddCenterIds = centerIdsInOrder.filter((id) => !existingCenterIds.has(id));

  const centersToAdd = await Promise.all(toAddCenterIds.map((id) => findCenterById(id)));
  for (const center of centersToAdd) {
    if (!center) throw new CenterNotFoundError();
    if (!center.territoryId || !permittedTerritoryIds.has(center.territoryId)) {
      throw new CenterOutsideTerritoryError();
    }
  }

  if (route?.userId && route.date) {
    const activeElsewhere = await findActiveCenterIdsForVisitorOnDate(
      route.userId,
      route.date,
      route.id,
    );
    if (toAddCenterIds.some((id) => activeElsewhere.has(id))) {
      throw new DuplicateCenterOnRouteError();
    }
  }

  const resolvedRouteId = route?.id ?? (await createRouteRow(actorId)).id;

  await Promise.all(toRemove.map((item) => deleteRouteItem(item.id)));

  const existingByCenterId = new Map(editableExistingItems.map((item) => [item.center.id, item]));
  await Promise.all(
    centerIdsInOrder.map(async (centerId, sequence) => {
      const existing = existingByCenterId.get(centerId);
      if (existing) {
        await updateRouteItemSequence(existing.id, sequence, actorId);
        return;
      }
      await createRouteItem({
        route: { connect: { id: resolvedRouteId } },
        center: { connect: { id: centerId } },
        sequence,
        createdBy: actorId,
        updatedBy: actorId,
      });
    }),
  );

  return resolvedRouteId;
}

// Strictly the visitor themselves — no chain exception, not even ADMIN.
// Deliberately not gated by isRouteEditable: a visit is normally completed
// on or after its own date, exactly when content editing has locked.
export async function completeRouteItem(routeItemId: string, actorId: string): Promise<void> {
  const item = await findRouteItemById(routeItemId);
  if (!item) return;
  if (item.route.userId !== actorId) throw new RouteNotOwnedError();

  await updateRouteItemStatus(routeItemId, "COMPLETED", actorId);
}

// Visitor or anyone with assign-team capability in their upward chain —
// only meaningful once a route is assigned (an unassigned item has no
// visitor-level "cancel" claim; remove it via Route Visits instead).
export async function cancelRouteItem(
  routeItemId: string,
  actorId: string,
  actorRoleName: string,
): Promise<void> {
  const item = await findRouteItemById(routeItemId);
  if (!item) return;
  if (item.route.userId === null) throw new RouteNotAuthorizedError();
  await assertCanActOnRoute(item.route, actorId, actorRoleName);

  await updateRouteItemStatus(routeItemId, "CANCELLED", actorId);
}

async function assertTargetInReach(
  targetUserId: string,
  actorId: string,
  actorRoleName: string,
): Promise<void> {
  if (actorRoleName === "ADMIN" || actorId === targetUserId) return;
  if (!ASSIGN_CAPABLE_ROLES.has(actorRoleName)) throw new RouteNotAuthorizedError();

  const downstream = await getDownstreamUserIds(actorId);
  if (!downstream.includes(targetUserId)) throw new RouteNotAuthorizedError();
}

async function assertItemsFitTerritoryAndNoDuplicates(
  route: RouteWithItems,
  targetUserId: string,
  date: Date,
): Promise<void> {
  const [permittedTerritoryIds, activeElsewhere] = await Promise.all([
    getPermittedTerritoryIds(targetUserId),
    findActiveCenterIdsForVisitorOnDate(targetUserId, date, route.id),
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

// Covers both first-time assignment (route currently unassigned — updates
// in place) and reassignment (route already assigned to someone else —
// creates a brand-new route for the new visitor, moves every item onto it,
// and deletes the now-empty source; never merges into a route the new
// visitor already happens to have that day, per the user's explicit
// decision that visitors can hold several independent routes per date).
export async function assignRoute(
  routeId: string,
  targetUserId: string,
  date: Date,
  actorId: string,
  actorRoleName: string,
): Promise<string> {
  const route = await findRouteById(routeId);
  if (!route) throw new RouteNotAuthorizedError();

  await assertTargetInReach(targetUserId, actorId, actorRoleName);
  await assertItemsFitTerritoryAndNoDuplicates(route, targetUserId, date);

  if (route.userId === null) {
    await assignRouteRow(routeId, targetUserId, date, actorId);
    return routeId;
  }

  // Reassignment — only valid while every item is still PENDING or
  // CANCELLED; completed history can't move.
  if (route.items.some((item) => item.status === "COMPLETED")) {
    throw new RouteHasCompletedItemsError();
  }

  const newRoute = await createRouteRow(actorId);
  await assignRouteRow(newRoute.id, targetUserId, date, actorId);
  await moveRouteItems(routeId, newRoute.id);
  await deleteRouteRow(routeId);
  return newRoute.id;
}

// "Cancel the assignment" — bulk-cancels every still-PENDING item, same
// authorization boundary as every other action on an assigned route. Does
// NOT revert the route to unassigned; completed items (if any) are
// untouched, cancelled items stay cancelled, only PENDING flips.
export async function cancelRouteAssignment(
  routeId: string,
  actorId: string,
  actorRoleName: string,
): Promise<void> {
  const route = await findRouteById(routeId);
  if (!route || route.userId === null) return;
  await assertCanActOnRoute(route, actorId, actorRoleName);

  await cancelPendingRouteItems(routeId, actorId);
}
