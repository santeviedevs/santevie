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

// RT-00001 — from route_code_seq (created in the migration), immutable once
// written. A sequence value is never reused, so two concurrent creations
// can't collide.
function formatRouteCode(n: number): string {
  return `RT-${String(n).padStart(5, "0")}`;
}

async function nextRouteCodeNumber(db: Db): Promise<number> {
  const rows = await db.$queryRaw<{ n: bigint }[]>`SELECT nextval('route_code_seq') AS n`;
  return Number(rows[0]!.n);
}

export async function createRouteRow(
  actorId: string,
  db: Db = prisma,
): Promise<Prisma.RouteGetPayload<object>> {
  const code = formatRouteCode(await nextRouteCodeNumber(db));
  return db.route.create({ data: { code, createdBy: actorId, updatedBy: actorId } });
}

export function findRouteById(id: string): Promise<RouteWithItems | null> {
  return prisma.route.findUnique({ where: { id }, include: routeInclude });
}

// The reach of the Plan Routes / Assign Routes screens: the actor's own
// still-unassigned drafts, plus any route already assigned to someone in
// their downstream chain. `assignedUserIds` undefined means ADMIN — matches
// assertCanActOnRoute's own ADMIN bypass exactly: no restriction at all,
// every route, including other actors' unassigned drafts (not just the
// ADMIN's own).
type RouteScope = { creatorId: string; assignedUserIds: string[] | undefined };

function routeScopeWhere(scope: RouteScope): Prisma.RouteWhereInput {
  return scope.assignedUserIds
    ? {
        OR: [
          { userId: null, createdBy: scope.creatorId },
          { userId: { in: scope.assignedUserIds } },
        ],
      }
    : {};
}

export function findEditableRoutes(scope: RouteScope): Promise<RouteWithItems[]> {
  return prisma.route.findMany({
    where: routeScopeWhere(scope),
    include: routeInclude,
    orderBy: { createdAt: "desc" },
  });
}

// --- Assign Routes table (server-side filtered and paginated) ---

export type RouteTableFilters = {
  q?: string;
  assigneeId?: string;
  status?: "ASSIGNED" | "IN_PROGRESS" | "MISSED" | "COMPLETED" | "CANCELLED";
  from?: Date;
  to?: Date;
};

// The derived-status filter, expressed over the stored data (the status
// itself is never stored — see deriveRouteStatus in route-service.ts, which
// these clauses must stay in step with). `today` is the Kinshasa calendar
// date: an assigned route with a PENDING item past its endDate is MISSED.
function statusWhere(
  status: NonNullable<RouteTableFilters["status"]>,
  today: Date,
): Prisma.RouteWhereInput {
  const assigned: Prisma.RouteWhereInput = { userId: { not: null } };
  const hasPending: Prisma.RouteWhereInput = { items: { some: { status: "PENDING" } } };
  const noPending: Prisma.RouteWhereInput = { items: { none: { status: "PENDING" } } };
  const hasCompleted: Prisma.RouteWhereInput = { items: { some: { status: "COMPLETED" } } };
  const noCompleted: Prisma.RouteWhereInput = { items: { none: { status: "COMPLETED" } } };
  const pastEnd: Prisma.RouteWhereInput = { endDate: { lt: today } };
  const notPastEnd: Prisma.RouteWhereInput = {
    OR: [{ endDate: null }, { endDate: { gte: today } }],
  };

  switch (status) {
    case "MISSED":
      return { AND: [assigned, hasPending, pastEnd] };
    case "IN_PROGRESS":
      return { AND: [assigned, hasPending, hasCompleted, notPastEnd] };
    case "ASSIGNED":
      return {
        AND: [
          assigned,
          notPastEnd,
          { OR: [{ items: { none: {} } }, { AND: [hasPending, noCompleted] }] },
        ],
      };
    case "COMPLETED":
      return { AND: [assigned, noPending, hasCompleted] };
    case "CANCELLED":
      return {
        AND: [assigned, noPending, noCompleted, { items: { some: { status: "CANCELLED" } } }],
      };
  }
}

function tableWhere(
  scope: RouteScope,
  filters: RouteTableFilters,
  today: Date,
): Prisma.RouteWhereInput {
  // The table lists existing assignments only — unassigned routes are picked
  // in the assign form instead — and the actor's scope still applies on top.
  const and: Prisma.RouteWhereInput[] = [routeScopeWhere(scope), { userId: { not: null } }];

  if (filters.q) {
    const contains = { contains: filters.q, mode: "insensitive" as const };
    and.push({
      OR: [
        { code: contains },
        { items: { some: { center: { OR: [{ name: contains }, { code: contains }] } } } },
      ],
    });
  }
  if (filters.assigneeId) and.push({ userId: filters.assigneeId });
  // Date-range filter = overlap with [from, to], either bound optional.
  if (filters.from) and.push({ endDate: { gte: filters.from } });
  if (filters.to) and.push({ startDate: { lte: filters.to } });
  if (filters.status) and.push(statusWhere(filters.status, today));

  return { AND: and };
}

export async function findRoutesPage(params: {
  scope: RouteScope;
  filters: RouteTableFilters;
  today: Date;
  skip: number;
  take: number;
}): Promise<{ routes: RouteWithItems[]; total: number }> {
  const where = tableWhere(params.scope, params.filters, params.today);
  const [routes, total] = await Promise.all([
    prisma.route.findMany({
      where,
      include: routeInclude,
      // Unassigned work first (it's what needs action), then newest ranges.
      orderBy: [{ startDate: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
      skip: params.skip,
      take: params.take,
    }),
    prisma.route.count({ where }),
  ]);
  return { routes, total };
}

// --- Assign form: eligible-route search ---

export type AssignableRouteRow = Prisma.RouteGetPayload<{
  select: {
    id: true;
    code: true;
    items: {
      select: {
        status: true;
        center: { select: { name: true } };
        contacts: { select: { id: true } };
      };
    };
  };
}>;

// Unassigned routes the actor may assign (their own drafts; ADMIN: anyone's)
// that still have something to visit. Bounded by `limit`; matches the route
// code or any of its centers' name/code.
export function searchAssignableRoutes(params: {
  creatorId: string;
  isAdmin: boolean;
  q: string;
  limit: number;
}): Promise<AssignableRouteRow[]> {
  const contains = { contains: params.q, mode: "insensitive" as const };
  return prisma.route.findMany({
    where: {
      userId: null,
      ...(params.isAdmin ? {} : { createdBy: params.creatorId }),
      items: { some: { status: "PENDING" } },
      ...(params.q
        ? {
            OR: [
              { code: contains },
              { items: { some: { center: { OR: [{ name: contains }, { code: contains }] } } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      code: true,
      items: {
        select: {
          status: true,
          center: { select: { name: true } },
          contacts: { select: { id: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: params.limit,
  });
}

export function findRoutesForVisitor(visitorId: string): Promise<RouteWithItems[]> {
  return prisma.route.findMany({
    where: { userId: visitorId },
    include: routeInclude,
    orderBy: { startDate: "desc" },
  });
}

// The visitor's routes whose assignment range touches [from, to] — the
// Home screen's This Week / Upcoming Week source. One route is one row no
// matter how many weeks it spans; the caller places it in each week it
// overlaps.
export function findRoutesForVisitorOverlapping(
  visitorId: string,
  from: Date,
  to: Date,
): Promise<RouteWithItems[]> {
  return prisma.route.findMany({
    where: { userId: visitorId, startDate: { lte: to }, endDate: { gte: from } },
    include: routeInclude,
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
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

// Sets who holds the route and for which range — used for both first-time
// assignment and reassignment, which update this same row in place (same id,
// same code); the history is appended separately (createRouteAssignmentRow).
export function assignRouteRow(
  routeId: string,
  userId: string,
  startDate: Date,
  endDate: Date,
  actorId: string,
  db: Db = prisma,
): Promise<Prisma.RouteGetPayload<object>> {
  return db.route.update({
    where: { id: routeId },
    data: { user: { connect: { id: userId } }, startDate, endDate, updatedBy: actorId },
  });
}

// Append-only history of assign / reassign / cancel. Records the assignee
// and range as of the event.
export function createRouteAssignmentRow(
  data: {
    routeId: string;
    action: "ASSIGNED" | "REASSIGNED" | "CANCELLED";
    userId: string;
    startDate: Date | null;
    endDate: Date | null;
  },
  actorId: string,
  db: Db = prisma,
) {
  return db.routeAssignment.create({
    data: { ...data, createdBy: actorId, updatedBy: actorId },
  });
}

// The duplicate-prevention check (per-visitor, across all of that visitor's
// routes) — every center already actively planned (PENDING or COMPLETED;
// CANCELLED doesn't count as "still planned") for this visitor in a range
// that overlaps [startDate, endDate], across every route, optionally
// excluding one route's own items (so checking a route against itself
// during assignment doesn't self-conflict).
export async function findActiveCenterIdsForVisitorInRange(
  visitorId: string,
  startDate: Date,
  endDate: Date,
  excludeRouteId?: string,
): Promise<Set<string>> {
  const items = await prisma.routeItem.findMany({
    where: {
      status: { in: ["PENDING", "COMPLETED"] },
      route: {
        userId: visitorId,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        ...(excludeRouteId ? { id: { not: excludeRouteId } } : {}),
      },
    },
    select: { centerId: true },
  });
  return new Set(items.map((item) => item.centerId));
}
