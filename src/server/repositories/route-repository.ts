import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

const routeInclude = {
  items: {
    include: { center: { select: { id: true, name: true, code: true, territoryId: true } } },
    orderBy: { sequence: "asc" },
  },
} satisfies Prisma.RouteInclude;

export type RouteWithItems = Prisma.RouteGetPayload<{ include: typeof routeInclude }>;
export type RouteItemRow = Prisma.RouteItemGetPayload<object>;

export function createRouteRow(actorId: string): Promise<Prisma.RouteGetPayload<object>> {
  return prisma.route.create({ data: { createdBy: actorId, updatedBy: actorId } });
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

export function createRouteItem(data: Prisma.RouteItemCreateInput): Promise<RouteItemRow> {
  return prisma.routeItem.create({ data });
}

export function findRouteItemById(
  id: string,
): Promise<(RouteItemRow & { route: Prisma.RouteGetPayload<object> }) | null> {
  return prisma.routeItem.findUnique({ where: { id }, include: { route: true } });
}

export function deleteRouteItem(id: string): Promise<RouteItemRow> {
  return prisma.routeItem.delete({ where: { id } });
}

export function updateRouteItemSequence(
  id: string,
  sequence: number,
  actorId: string,
): Promise<RouteItemRow> {
  return prisma.routeItem.update({ where: { id }, data: { sequence, updatedBy: actorId } });
}

export function updateRouteItemStatus(
  id: string,
  status: Prisma.RouteItemUpdateInput["status"],
  actorId: string,
): Promise<RouteItemRow> {
  return prisma.routeItem.update({ where: { id }, data: { status, updatedBy: actorId } });
}

// Bulk-cancels every still-PENDING item under a route — "cancel the
// assignment" (Assignment screen), not a per-item action.
export function cancelPendingRouteItems(
  routeId: string,
  actorId: string,
): Promise<Prisma.BatchPayload> {
  return prisma.routeItem.updateMany({
    where: { routeId, status: "PENDING" },
    data: { status: "CANCELLED", updatedBy: actorId },
  });
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
