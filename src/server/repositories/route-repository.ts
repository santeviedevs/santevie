import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

const routeInclude = {
  items: {
    include: {
      center: {
        select: {
          id: true,
          name: true,
          code: true,
          territoryId: true,
          type: { select: { name: true } },
        },
      },
      contacts: {
        include: { contact: { select: { id: true, name: true, code: true, status: true } } },
        orderBy: { contact: { name: "asc" } },
      },
    },
    orderBy: { sequence: "asc" },
  },
} satisfies Prisma.RouteInclude;

// Either the shared client or an interactive-transaction client — every
// write that has to be atomic with others takes one, defaulting to the
// shared client so single-statement callers don't have to care.
export type Db = Prisma.TransactionClient;

// Runs `fn` in one database transaction; any throw rolls back everything
// `fn` wrote. The service uses this so a route save, or a status change
// that cascades between Contacts and their Center, can never half-apply.
export function runInTransaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}

export type RouteWithItems = Prisma.RouteGetPayload<{ include: typeof routeInclude }>;
export type RouteItemRow = Prisma.RouteItemGetPayload<object>;
export type RouteItemContactRow = Prisma.RouteItemContactGetPayload<object>;

export function createRouteRow(
  actorId: string,
  db: Db = prisma,
): Promise<Prisma.RouteGetPayload<object>> {
  return db.route.create({ data: { createdBy: actorId, updatedBy: actorId } });
}

export function findRouteById(id: string): Promise<RouteWithItems | null> {
  return prisma.route.findUnique({ where: { id }, include: routeInclude });
}

// Route Visits (content) scope — every route the actor may currently edit
// content on: their own still-unassigned drafts, plus any route already
// assigned to someone in their downstream chain. `assignedUserIds`
// undefined means ADMIN — matches assertCanActOnRoute's own ADMIN bypass
// exactly: no restriction at all, every route, including other actors'
// unassigned drafts (not just the ADMIN's own).
export function findEditableRoutes(params: {
  creatorId: string;
  assignedUserIds: string[] | undefined;
}): Promise<RouteWithItems[]> {
  return prisma.route.findMany({
    where: params.assignedUserIds
      ? {
          OR: [
            { userId: null, createdBy: params.creatorId },
            { userId: { in: params.assignedUserIds } },
          ],
        }
      : {},
    include: routeInclude,
    orderBy: { createdAt: "desc" },
  });
}

// Assignment screen scope — same reach as findEditableRoutes (the actor's
// own unassigned drafts, plus routes already assigned within their
// downstream chain) since assigning/reassigning/cancelling an assignment
// uses the identical authorization boundary as editing content.
export const findAssignableRoutes = findEditableRoutes;

export function findRoutesForVisitor(visitorId: string): Promise<RouteWithItems[]> {
  return prisma.route.findMany({
    where: { userId: visitorId },
    include: routeInclude,
    orderBy: { date: "desc" },
  });
}

export function createRouteItem(
  data: Prisma.RouteItemCreateInput,
  db: Db = prisma,
): Promise<RouteItemRow> {
  return db.routeItem.create({ data });
}

const routeItemWithRouteInclude = {
  route: true,
  contacts: true,
} satisfies Prisma.RouteItemInclude;

export function findRouteItemById(
  id: string,
  db: Db = prisma,
): Promise<Prisma.RouteItemGetPayload<{ include: typeof routeItemWithRouteInclude }> | null> {
  return db.routeItem.findUnique({ where: { id }, include: routeItemWithRouteInclude });
}

export function deleteRouteItem(id: string, db: Db = prisma): Promise<RouteItemRow> {
  return db.routeItem.delete({ where: { id } });
}

export function updateRouteItemSequence(
  id: string,
  sequence: number,
  actorId: string,
  db: Db = prisma,
): Promise<RouteItemRow> {
  return db.routeItem.update({ where: { id }, data: { sequence, updatedBy: actorId } });
}

export function updateRouteItemStatus(
  id: string,
  status: Prisma.RouteItemUpdateInput["status"],
  actorId: string,
  db: Db = prisma,
): Promise<RouteItemRow> {
  return db.routeItem.update({ where: { id }, data: { status, updatedBy: actorId } });
}

// Bulk-cancels every still-PENDING item under a route that has no Contacts
// — "cancel the assignment" (Assignment screen), not a per-item action. An
// item that does have Contacts is never cancelled directly: its status is
// derived from its Contacts (see cancelPendingContactsOnRoute below).
export function cancelPendingContactlessRouteItems(
  routeId: string,
  actorId: string,
  db: Db = prisma,
): Promise<Prisma.BatchPayload> {
  return db.routeItem.updateMany({
    where: { routeId, status: "PENDING", contacts: { none: {} } },
    data: { status: "CANCELLED", updatedBy: actorId },
  });
}

// --- RouteItemContact ---

export function findRouteItemContactById(
  id: string,
  db: Db = prisma,
): Promise<
  | (RouteItemContactRow & { routeItem: Prisma.RouteItemGetPayload<{ include: { route: true } }> })
  | null
> {
  return db.routeItemContact.findUnique({
    where: { id },
    include: { routeItem: { include: { route: true } } },
  });
}

export function createRouteItemContacts(
  routeItemId: string,
  contactIds: string[],
  actorId: string,
  db: Db = prisma,
): Promise<Prisma.BatchPayload> {
  return db.routeItemContact.createMany({
    data: contactIds.map((contactId) => ({
      routeItemId,
      contactId,
      createdBy: actorId,
      updatedBy: actorId,
    })),
  });
}

// Only ever called with ids of PENDING rows — the service never passes a
// COMPLETED or CANCELLED one, but the status filter makes that a database
// guarantee, not just a convention.
export function deletePendingRouteItemContacts(
  routeItemId: string,
  contactIds: string[],
  db: Db = prisma,
): Promise<Prisma.BatchPayload> {
  return db.routeItemContact.deleteMany({
    where: { routeItemId, contactId: { in: contactIds }, status: "PENDING" },
  });
}

// Removing a Center from a route also removes its non-COMPLETED Contact
// rows (the service refuses the removal outright if any are COMPLETED, so
// completed history is never deleted).
export function deleteNonCompletedRouteItemContacts(
  routeItemId: string,
  db: Db = prisma,
): Promise<Prisma.BatchPayload> {
  return db.routeItemContact.deleteMany({
    where: { routeItemId, status: { not: "COMPLETED" } },
  });
}

export function updateRouteItemContactStatus(
  id: string,
  status: Prisma.RouteItemContactUpdateInput["status"],
  actorId: string,
  db: Db = prisma,
): Promise<RouteItemContactRow> {
  return db.routeItemContact.update({ where: { id }, data: { status, updatedBy: actorId } });
}

export function cancelPendingContactsOnItem(
  routeItemId: string,
  actorId: string,
  db: Db = prisma,
): Promise<Prisma.BatchPayload> {
  return db.routeItemContact.updateMany({
    where: { routeItemId, status: "PENDING" },
    data: { status: "CANCELLED", updatedBy: actorId },
  });
}

export function cancelPendingContactsOnRoute(
  routeId: string,
  actorId: string,
  db: Db = prisma,
): Promise<Prisma.BatchPayload> {
  return db.routeItemContact.updateMany({
    where: { routeItem: { routeId }, status: "PENDING" },
    data: { status: "CANCELLED", updatedBy: actorId },
  });
}

export async function listContactStatusesForItem(
  routeItemId: string,
  db: Db = prisma,
): Promise<Array<"PENDING" | "COMPLETED" | "CANCELLED">> {
  const rows = await db.routeItemContact.findMany({
    where: { routeItemId },
    select: { status: true },
  });
  return rows.map((row) => row.status);
}

// The still-PENDING items under a route that have at least one Contact —
// the ones whose status needs re-deriving after their Contacts change in
// bulk.
export async function listPendingItemIdsWithContacts(
  routeId: string,
  db: Db = prisma,
): Promise<string[]> {
  const rows = await db.routeItem.findMany({
    where: { routeId, status: "PENDING", contacts: { some: {} } },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

// First-time assignment — sets userId/date in place on a currently-
// unassigned route. Reassignment never calls this; it creates a new route
// instead (see moveRouteItemsToNewRoute + deleteRouteRow below).
export function assignRouteRow(
  routeId: string,
  userId: string,
  date: Date,
  actorId: string,
): Promise<Prisma.RouteGetPayload<object>> {
  return prisma.route.update({
    where: { id: routeId },
    data: { user: { connect: { id: userId } }, date, updatedBy: actorId },
  });
}

// Reassignment's actual move — repoints every item from the source route
// onto a freshly created destination route (createRouteRow + this +
// deleteRouteRow, run by the service as one logical operation). Repointing
// the FK is simpler and just as correct as copying rows, since nothing
// else references a RouteItem's id externally.
export function moveRouteItems(
  fromRouteId: string,
  toRouteId: string,
): Promise<Prisma.BatchPayload> {
  return prisma.routeItem.updateMany({
    where: { routeId: fromRouteId },
    data: { routeId: toRouteId },
  });
}

export function deleteRouteRow(id: string): Promise<Prisma.RouteGetPayload<object>> {
  return prisma.route.delete({ where: { id } });
}

// The duplicate-prevention check (per-visitor, per-date, global across all
// of that visitor's routes) — every center already actively planned
// (PENDING or COMPLETED; CANCELLED doesn't count as "still planned") for
// this visitor on this date, across every route, optionally excluding one
// route's own items (so checking a route against itself during assignment
// doesn't self-conflict).
export async function findActiveCenterIdsForVisitorOnDate(
  visitorId: string,
  date: Date,
  excludeRouteId?: string,
): Promise<Set<string>> {
  const items = await prisma.routeItem.findMany({
    where: {
      status: { in: ["PENDING", "COMPLETED"] },
      route: {
        userId: visitorId,
        date,
        ...(excludeRouteId ? { id: { not: excludeRouteId } } : {}),
      },
    },
    select: { centerId: true },
  });
  return new Set(items.map((item) => item.centerId));
}
