import {
  type CenterSearchQuery,
  type ContactSearchQuery,
  isRouteEditable,
  type RouteContactIssue,
  type RouteSelectionInput,
} from "@/lib/schemas/route";
import {
  findCenterById,
  searchActiveCentersInTerritories,
} from "@/server/repositories/center-repository";
import {
  findCenterContactLinks,
  searchContactsForCenter,
} from "@/server/repositories/contact-repository";
import {
  assignRouteRow,
  cancelPendingContactlessRouteItems,
  cancelPendingContactsOnItem,
  cancelPendingContactsOnRoute,
  createRouteItem,
  createRouteItemContacts,
  createRouteRow,
  type Db,
  deleteNonCompletedRouteItemContacts,
  deletePendingRouteItemContacts,
  deleteRouteItem,
  deleteRouteRow,
  findActiveCenterIdsForVisitorOnDate,
  findAssignableRoutes,
  findEditableRoutes,
  findRouteById,
  findRouteItemById,
  findRouteItemContactById,
  findRoutesForVisitor,
  listContactStatusesForItem,
  listPendingItemIdsWithContacts,
  moveRouteItems,
  type RouteWithItems,
  runInTransaction,
  updateRouteItemContactStatus,
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

// Why a selected Contact is flagged on screen: the Contact<->Center link
// was removed since the route was saved, or the Contact has gone inactive.
// History is kept either way; the editor refuses to save a pending one
// until it's removed or replaced.

export type RouteItemContactSummary = {
  id: string;
  contactId: string;
  name: string;
  code: string;
  // PENDING/COMPLETED/CANCELLED as actually stored; MISSED is computed.
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "MISSED";
  issue: RouteContactIssue | null;
};

export type RouteItemSummary = {
  id: string;
  sequence: number;
  // PENDING/COMPLETED/CANCELLED as actually stored; MISSED is never
  // stored — see the RouteItemStatus enum comment in schema.prisma. For a
  // center that has contacts, the stored status is derived from them (see
  // deriveCenterStatus).
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "MISSED";
  center: {
    id: string;
    name: string;
    code: string;
    territoryId: string | null;
    typeName: string;
  };
  contacts: RouteItemContactSummary[];
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

// A Center that has Contacts takes its status from them: any PENDING
// Contact keeps it PENDING (a MISSED Contact is just a PENDING one past its
// date — it can still be completed late, so it is not terminal); once none
// are PENDING it is COMPLETED if at least one was completed, else
// CANCELLED. A Center with no Contacts has no derived status (null) — it is
// managed manually, exactly as before Contacts existed.
export function deriveCenterStatus(
  contactStatuses: ReadonlyArray<"PENDING" | "COMPLETED" | "CANCELLED">,
): "PENDING" | "COMPLETED" | "CANCELLED" | null {
  if (contactStatuses.length === 0) return null;
  if (contactStatuses.includes("PENDING")) return "PENDING";
  return contactStatuses.includes("COMPLETED") ? "COMPLETED" : "CANCELLED";
}

// Re-derives and stores a Center's status from its Contacts. Called inside
// the same transaction as every Contact change, so a Center can never
// contradict its Contacts.
async function syncCenterStatus(routeItemId: string, actorId: string, db: Db): Promise<void> {
  const derived = deriveCenterStatus(await listContactStatusesForItem(routeItemId, db));
  if (derived) await updateRouteItemStatus(routeItemId, derived, actorId, db);
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

  // One query for every (center, contact) link across every route shown —
  // never one per center.
  const allItems = routes.flatMap((route) => route.items);
  const centerIds = [...new Set(allItems.map((item) => item.center.id))];
  const contactIds = [
    ...new Set(allItems.flatMap((item) => item.contacts.map((row) => row.contactId))),
  ];
  const links = contactIds.length > 0 ? await findCenterContactLinks(centerIds, contactIds) : [];
  const linkedPairs = new Set(links.map((link) => `${link.centerId}:${link.contactId}`));

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
        typeName: item.center.type.name,
      },
      contacts: item.contacts.map((row) => ({
        id: row.id,
        contactId: row.contactId,
        name: row.contact.name,
        code: row.contact.code,
        status: itemDisplayStatus(row.status, route.date),
        issue: !linkedPairs.has(`${item.center.id}:${row.contactId}`)
          ? ("NOT_ASSOCIATED" as const)
          : row.contact.status === "INACTIVE"
            ? ("INACTIVE" as const)
            : null,
      })),
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

// The single "Save" action on the Plan Routes editor — nothing about a
// route's content is written until this runs. Takes the editor's whole
// desired list of centers (in order), each with its selected contacts, and
// diffs it against what's actually stored: centers no longer in the list
// get removed, new ones get created, everyone kept gets resequenced to
// match, and each kept center's pending contacts are added/removed to
// match. `routeId: null` covers a brand-new route — created here, in the
// same call, only once there's actually something to save. COMPLETED and
// CANCELLED items and contacts are never touched by the diff — only
// PENDING ones are ever part of the editable set. Every check runs before
// the first write, and every write runs in one transaction, so a failure
// can never leave a half-saved route.
export async function saveRouteContent(
  routeId: string | null,
  selections: RouteSelectionInput[],
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

  const centerIdsInOrder = selections.map((selection) => selection.centerId);
  if (new Set(centerIdsInOrder).size !== centerIdsInOrder.length) {
    throw new CenterAlreadyOnRouteError();
  }

  const editableExistingItems = (route?.items ?? []).filter((item) => item.status === "PENDING");
  const existingByCenterId = new Map(editableExistingItems.map((item) => [item.center.id, item]));
  // A center whose item is already COMPLETED/CANCELLED is history on this
  // route — it can't be re-added (the unique (route, center) constraint
  // would reject it anyway; this gives a clear message first).
  const finalizedCenterIds = new Set(
    (route?.items ?? []).filter((item) => item.status !== "PENDING").map((item) => item.center.id),
  );
  if (centerIdsInOrder.some((id) => finalizedCenterIds.has(id))) {
    throw new CenterAlreadyOnRouteError();
  }

  const keepCenterIds = new Set(centerIdsInOrder.filter((id) => existingByCenterId.has(id)));
  const toRemove = editableExistingItems.filter((item) => !keepCenterIds.has(item.center.id));
  const toAddCenterIds = centerIdsInOrder.filter((id) => !existingByCenterId.has(id));

  if (toRemove.some((item) => item.contacts.some((row) => row.status === "COMPLETED"))) {
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

  // Contacts — plan the per-center diff first, then validate every kept or
  // new selection against ContactCenter in one query. A contact that
  // already has a final status on this item can't be selected again.
  const contactPlans = selections.map((selection) => {
    const existing = existingByCenterId.get(selection.centerId);
    const existingRows = new Map((existing?.contacts ?? []).map((row) => [row.contactId, row]));
    for (const contactId of selection.contactIds) {
      const row = existingRows.get(contactId);
      if (row && row.status !== "PENDING") throw new ContactAlreadyOnRouteError();
    }
    const desired = new Set(selection.contactIds);
    return {
      centerId: selection.centerId,
      existingItemId: existing?.id ?? null,
      toDelete: (existing?.contacts ?? [])
        .filter((row) => row.status === "PENDING" && !desired.has(row.contactId))
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
      await deleteNonCompletedRouteItemContacts(item.id, tx);
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

      if (plan.toDelete.length > 0) await deletePendingRouteItemContacts(itemId, plan.toDelete, tx);
      if (plan.toCreate.length > 0)
        await createRouteItemContacts(itemId, plan.toCreate, actorId, tx);
      if (plan.existingItemId && (plan.toDelete.length > 0 || plan.toCreate.length > 0)) {
        await syncCenterStatus(itemId, actorId, tx);
      }
    }

    return resolvedRouteId;
  });
}

// Strictly the visitor themselves — no chain exception, not even ADMIN.
// Deliberately not gated by isRouteEditable: a visit is normally completed
// on or after its own date, exactly when content editing has locked. A
// center that has contacts can't be completed directly — it completes when
// its contacts do.
export async function completeRouteItem(routeItemId: string, actorId: string): Promise<void> {
  const item = await findRouteItemById(routeItemId);
  if (!item) return;
  if (item.route.userId !== actorId) throw new RouteNotOwnedError();
  if (item.contacts.length > 0) throw new CenterStatusDerivedError();

  await updateRouteItemStatus(routeItemId, "COMPLETED", actorId);
}

// Visitor or anyone with assign-team capability in their upward chain —
// only meaningful once a route is assigned (an unassigned item has no
// visitor-level "cancel" claim; remove it via Plan Routes instead). For a
// center with contacts, cancelling cancels its still-PENDING contacts
// (completed ones are untouched) and the center's status is then derived —
// so it ends COMPLETED, not CANCELLED, if any contact was already done.
export async function cancelRouteItem(
  routeItemId: string,
  actorId: string,
  actorRoleName: string,
): Promise<void> {
  const item = await findRouteItemById(routeItemId);
  if (!item) return;
  if (item.route.userId === null) throw new RouteNotAuthorizedError();
  await assertCanActOnRoute(item.route, actorId, actorRoleName);

  if (item.contacts.length > 0) {
    await runInTransaction(async (tx) => {
      await cancelPendingContactsOnItem(routeItemId, actorId, tx);
      await syncCenterStatus(routeItemId, actorId, tx);
    });
    return;
  }

  await updateRouteItemStatus(routeItemId, "CANCELLED", actorId);
}

// Strictly the visitor, same as completing a center.
export async function completeRouteItemContact(
  routeItemContactId: string,
  actorId: string,
): Promise<void> {
  const row = await findRouteItemContactById(routeItemContactId);
  if (!row) return;
  if (row.routeItem.route.userId !== actorId) throw new RouteNotOwnedError();
  if (row.status === "COMPLETED") return;
  if (row.status !== "PENDING") throw new ContactStatusConflictError();

  await runInTransaction(async (tx) => {
    await updateRouteItemContactStatus(routeItemContactId, "COMPLETED", actorId, tx);
    await syncCenterStatus(row.routeItemId, actorId, tx);
  });
}

// Same authorization as cancelling a center: the visitor or anyone with the
// visitor in their downstream chain. A completed contact can't be cancelled.
export async function cancelRouteItemContact(
  routeItemContactId: string,
  actorId: string,
  actorRoleName: string,
): Promise<void> {
  const row = await findRouteItemContactById(routeItemContactId);
  if (!row) return;
  if (row.routeItem.route.userId === null) throw new RouteNotAuthorizedError();
  await assertCanActOnRoute(row.routeItem.route, actorId, actorRoleName);
  if (row.status === "CANCELLED") return;
  if (row.status !== "PENDING") throw new ContactStatusConflictError();

  await runInTransaction(async (tx) => {
    await updateRouteItemContactStatus(routeItemContactId, "CANCELLED", actorId, tx);
    await syncCenterStatus(row.routeItemId, actorId, tx);
  });
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
  if (
    route.items.some(
      (item) =>
        item.status === "COMPLETED" || item.contacts.some((row) => row.status === "COMPLETED"),
    )
  ) {
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

  await runInTransaction(async (tx) => {
    await cancelPendingContactsOnRoute(routeId, actorId, tx);
    await cancelPendingContactlessRouteItems(routeId, actorId, tx);
    // Centers that have contacts take their status from them — re-derive
    // each one now that its pending contacts are cancelled.
    for (const itemId of await listPendingItemIdsWithContacts(routeId, tx)) {
      await syncCenterStatus(itemId, actorId, tx);
    }
  });
}

// --- Type-ahead search for the Plan Routes editor ---------------------------

// The territories a search may reach: the actor's own on a brand-new route;
// the route's visitor/creator's when editing an existing one (the same
// owner saveRouteContent validates against), after the same authorization
// every other action on that route requires.
async function resolveSearchTerritoryIds(
  routeId: string | undefined,
  actorId: string,
  actorRoleName: string,
): Promise<Set<string>> {
  if (!routeId) return getPermittedTerritoryIds(actorId);

  const route = await findRouteById(routeId);
  if (!route) throw new RouteNotAuthorizedError();
  await assertCanActOnRoute(route, actorId, actorRoleName);
  const ownerId = route.userId ?? route.createdBy;
  return ownerId ? getPermittedTerritoryIds(ownerId) : new Set<string>();
}

export type CenterSearchResult = {
  id: string;
  name: string;
  code: string;
  territoryId: string | null;
  typeName: string;
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
  }));
}

export type ContactSearchResult = {
  id: string;
  name: string;
  code: string;
  roleName: string;
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
    roleName: row.roleAtCenter.name,
  }));
}
