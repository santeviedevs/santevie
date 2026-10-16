import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";
import { territoryPathSelect } from "./territory-path-select";

// Shared plan content only — a route's stop list, never who's assigned to
// it (that's RouteAssignment). Used by the content-editing side of the
// feature (Plan Routes, reorder, complete/cancel item authorization lookup)
// where the assignee is irrelevant.
const routeContentInclude = {
  items: {
    include: {
      center: {
        select: {
          id: true,
          name: true,
          code: true,
          territoryId: true,
          type: { select: { name: true } },
          territory: territoryPathSelect,
        },
      },
      contacts: {
        include: {
          contact: {
            select: { id: true, name: true, code: true, status: true },
          },
          // Across every assignment, not one — content editing needs to
          // know "has anyone, ever, acted on this," not any one assignee's
          // view. Presence of a row (any status) means finalized.
          executions: { select: { status: true } },
        },
        orderBy: { contact: { name: "asc" } },
      },
      // Same "has anyone acted on this" signal for a contactless item.
      executions: { select: { status: true } },
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

export type RouteWithItems = Prisma.RouteGetPayload<{ include: typeof routeContentInclude }>;
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
  return prisma.route.findUnique({ where: { id }, include: routeContentInclude });
}

// --- Assignments: who holds a route, and their own progress through it ----

const assignmentWithRouteInclude = {
  route: { include: routeContentInclude },
  user: { select: { id: true, name: true } },
  // Scoped to this assignment by its own FK — never needs a separate filter.
  itemExecutions: { select: { routeItemId: true, status: true } },
  contactExecutions: { select: { routeItemContactId: true, status: true } },
} satisfies Prisma.RouteAssignmentInclude;

export type RouteAssignmentWithRoute = Prisma.RouteAssignmentGetPayload<{
  include: typeof assignmentWithRouteInclude;
}>;

export function findAssignmentById(id: string): Promise<RouteAssignmentWithRoute | null> {
  return prisma.routeAssignment.findUnique({ where: { id }, include: assignmentWithRouteInclude });
}

// Every ACTIVE assignment currently on a route — used to check "is this
// user already actively assigned here" and to validate a new assignment's
// items against every other active assignee's own active centers.
export function findActiveAssignmentsForRoute(
  routeId: string,
  db: Db = prisma,
): Promise<Prisma.RouteAssignmentGetPayload<object>[]> {
  return db.routeAssignment.findMany({ where: { routeId, status: "ACTIVE" } });
}

// Creates a brand-new ACTIVE assignment — used for both first-time
// assignment and reassignment (which cancels the old row first, see
// cancelAssignmentRow, then calls this for the new holder). Never mutates
// an existing assignment's holder in place; a route can carry several
// concurrent ones.
export function createAssignmentRow(
  data: { routeId: string; userId: string; startDate: Date; endDate: Date },
  actorId: string,
  db: Db = prisma,
): Promise<Prisma.RouteAssignmentGetPayload<object>> {
  return db.routeAssignment.create({
    data: {
      route: { connect: { id: data.routeId } },
      user: { connect: { id: data.userId } },
      status: "ACTIVE",
      startDate: data.startDate,
      endDate: data.endDate,
      createdBy: actorId,
      updatedBy: actorId,
    },
  });
}

export function cancelAssignmentRow(
  assignmentId: string,
  actorId: string,
  db: Db = prisma,
): Promise<Prisma.RouteAssignmentGetPayload<object>> {
  return db.routeAssignment.update({
    where: { id: assignmentId },
    data: { status: "CANCELLED", updatedBy: actorId },
  });
}

// The visitor's own active assignments, full content included — My Visits.
export function findActiveAssignmentsForVisitor(
  visitorId: string,
): Promise<RouteAssignmentWithRoute[]> {
  return prisma.routeAssignment.findMany({
    where: { userId: visitorId, status: "ACTIVE" },
    include: assignmentWithRouteInclude,
    orderBy: { startDate: "desc" },
  });
}

// The visitor's active assignments whose range touches [from, to] — the
// Home screen's This Week / Upcoming Week source. One assignment is one row
// no matter how many weeks it spans; the caller places it in each week it
// overlaps.
export function findActiveAssignmentsForVisitorOverlapping(
  visitorId: string,
  from: Date,
  to: Date,
): Promise<RouteAssignmentWithRoute[]> {
  return prisma.routeAssignment.findMany({
    where: { userId: visitorId, status: "ACTIVE", startDate: { lte: to }, endDate: { gte: from } },
    include: assignmentWithRouteInclude,
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
  });
}

// --- Add Routes / Plan Routes list (content only, no assignee shown) ------

// The reach of the Plan Routes screen: the actor's own routes (anything
// they created, or hold/held an assignment on), plus any route assigned to
// someone in their downstream chain. `assignedUserIds` undefined means
// ADMIN — matches assertCanActOnRoute's own ADMIN bypass exactly: no
// restriction at all.
type RouteScope = { creatorId: string; assignedUserIds: string[] | undefined };

function routeScopeWhere(scope: RouteScope): Prisma.RouteWhereInput {
  return scope.assignedUserIds
    ? {
        OR: [
          { createdBy: scope.creatorId },
          { assignments: { some: { userId: { in: scope.assignedUserIds } } } },
        ],
      }
    : {};
}

export type RouteContentFilters = { q?: string; assigneeId?: string; from?: Date; to?: Date };

function contentFilterClauses(filters: RouteContentFilters): Prisma.RouteWhereInput[] {
  const and: Prisma.RouteWhereInput[] = [];
  if (filters.q) {
    const contains = { contains: filters.q, mode: "insensitive" as const };
    and.push({
      OR: [
        { code: contains },
        { items: { some: { center: { OR: [{ name: contains }, { code: contains }] } } } },
        {
          items: {
            some: {
              contacts: { some: { contact: { OR: [{ name: contains }, { code: contains }] } } },
            },
          },
        },
      ],
    });
  }
  // A route reached through a specific assignee only when that assignee
  // actually holds an (ACTIVE) assignment overlapping the given range.
  if (filters.assigneeId || filters.from || filters.to) {
    and.push({
      assignments: {
        some: {
          status: "ACTIVE",
          ...(filters.assigneeId ? { userId: filters.assigneeId } : {}),
          ...(filters.from ? { endDate: { gte: filters.from } } : {}),
          ...(filters.to ? { startDate: { lte: filters.to } } : {}),
        },
      },
    });
  }
  return and;
}

// The Add Routes list, one page at a time — newest first, same scope as
// everywhere else. The total comes from the same where clause, so the page
// count always matches what the list can show.
export async function findEditableRoutesPage(params: {
  scope: RouteScope;
  filters: RouteContentFilters;
  skip: number;
  take: number;
}): Promise<{ routes: RouteWithItems[]; total: number }> {
  // Filters only ever narrow the actor's scope, never widen it.
  const where: Prisma.RouteWhereInput = {
    AND: [routeScopeWhere(params.scope), ...contentFilterClauses(params.filters)],
  };
  const [routes, total] = await Promise.all([
    prisma.route.findMany({
      where,
      include: routeContentInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: params.skip,
      take: params.take,
    }),
    prisma.route.count({ where }),
  ]);
  return { routes, total };
}

// --- Assign Routes table (server-side filtered and paginated) -------------
// One row per assignment, not per route — a route with two concurrent
// assignees produces two rows here, same shape as the Activity Assignment
// table.

export type RouteAssignmentTableFilters = {
  q?: string;
  assigneeId?: string;
  status?: "ASSIGNED" | "IN_PROGRESS" | "MISSED" | "COMPLETED" | "CANCELLED";
  from?: Date;
  to?: Date;
};

// The derived-status filter, expressed over the stored data (the status
// itself is never stored — see deriveRouteStatus in route-service.ts, which
// these clauses must stay in step with). `today` is the Kinshasa calendar
// date: an assignment with a PENDING item (for it) past its endDate is
// MISSED. CANCELLED here means the assignment itself was cancelled — same
// signal the old model derived from item statuses, now read directly off
// RouteAssignment.status instead, since cancelling an assignment no longer
// forces every item to a terminal state on rows shared with other
// assignees.
function assignmentStatusWhere(
  status: NonNullable<RouteAssignmentTableFilters["status"]>,
  today: Date,
): Prisma.RouteAssignmentWhereInput {
  const active: Prisma.RouteAssignmentWhereInput = { status: "ACTIVE" };
  const hasPending: Prisma.RouteAssignmentWhereInput = {
    itemExecutions: { some: { status: "PENDING" } },
  };
  const hasPendingOrNone: Prisma.RouteAssignmentWhereInput = {
    route: { items: { some: {} } },
  };
  const hasCompleted: Prisma.RouteAssignmentWhereInput = {
    itemExecutions: { some: { status: "COMPLETED" } },
  };
  const pastEnd: Prisma.RouteAssignmentWhereInput = { endDate: { lt: today } };
  const notPastEnd: Prisma.RouteAssignmentWhereInput = {
    OR: [{ endDate: null }, { endDate: { gte: today } }],
  };

  switch (status) {
    case "CANCELLED":
      return { status: "CANCELLED" };
    case "MISSED":
      return { AND: [active, hasPending, pastEnd] };
    case "IN_PROGRESS":
      return { AND: [active, hasPending, hasCompleted, notPastEnd] };
    case "ASSIGNED":
      return { AND: [active, notPastEnd, hasPendingOrNone] };
    case "COMPLETED":
      return { AND: [active, hasCompleted] };
  }
}

function assignmentFilterClauses(
  filters: Pick<RouteAssignmentTableFilters, "q" | "assigneeId" | "from" | "to">,
): Prisma.RouteAssignmentWhereInput[] {
  const and: Prisma.RouteAssignmentWhereInput[] = [];
  if (filters.q) {
    const contains = { contains: filters.q, mode: "insensitive" as const };
    and.push({
      route: {
        OR: [
          { code: contains },
          { items: { some: { center: { OR: [{ name: contains }, { code: contains }] } } } },
          {
            items: {
              some: {
                contacts: { some: { contact: { OR: [{ name: contains }, { code: contains }] } } },
              },
            },
          },
        ],
      },
    });
  }
  if (filters.assigneeId) and.push({ userId: filters.assigneeId });
  if (filters.from) and.push({ endDate: { gte: filters.from } });
  if (filters.to) and.push({ startDate: { lte: filters.to } });
  return and;
}

function assignmentTableWhere(
  scope: RouteScope,
  filters: RouteAssignmentTableFilters,
  today: Date,
): Prisma.RouteAssignmentWhereInput {
  const scopeClause: Prisma.RouteAssignmentWhereInput = scope.assignedUserIds
    ? { userId: { in: scope.assignedUserIds } }
    : {};
  const and: Prisma.RouteAssignmentWhereInput[] = [
    scopeClause,
    ...assignmentFilterClauses(filters),
  ];
  if (filters.status) and.push(assignmentStatusWhere(filters.status, today));
  return { AND: and };
}

export async function findAssignmentsPage(params: {
  scope: RouteScope;
  filters: RouteAssignmentTableFilters;
  today: Date;
  skip: number;
  take: number;
}): Promise<{ assignments: RouteAssignmentWithRoute[]; total: number }> {
  const where = assignmentTableWhere(params.scope, params.filters, params.today);
  const [assignments, total] = await Promise.all([
    prisma.routeAssignment.findMany({
      where,
      include: assignmentWithRouteInclude,
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      skip: params.skip,
      take: params.take,
    }),
    prisma.routeAssignment.count({ where }),
  ]);
  return { assignments, total };
}

// --- Assign form: eligible-route search ------------------------------------

export type AssignableRouteRow = Prisma.RouteGetPayload<{
  select: {
    id: true;
    code: true;
    items: {
      select: {
        center: { select: { name: true } };
        contacts: { select: { id: true } };
      };
    };
  };
}>;

// Routes the actor may assign (their own, or within their downstream
// chain's reach via routeScopeWhere; ADMIN: anyone's) that still have
// something to visit. Concurrent assignment means an already-assigned
// route is still offered here — assigning it to a second person is the
// point, not something to filter out.
export function searchAssignableRoutes(params: {
  scope: RouteScope;
  q: string;
  limit: number;
}): Promise<AssignableRouteRow[]> {
  const contains = { contains: params.q, mode: "insensitive" as const };
  return prisma.route.findMany({
    where: {
      AND: [
        routeScopeWhere(params.scope),
        { items: { some: {} } },
        params.q
          ? {
              OR: [
                { code: contains },
                { items: { some: { center: { OR: [{ name: contains }, { code: contains }] } } } },
              ],
            }
          : {},
      ],
    },
    select: {
      id: true,
      code: true,
      items: {
        select: {
          center: { select: { name: true } },
          contacts: { select: { id: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: params.limit,
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

// --- RouteItemContact (shared plan content) --------------------------------

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

// Deletes Contact rows outright — only ever called for ones nobody has
// completed on any assignment (the service checks execution rows first).
export function deleteRouteItemContacts(
  routeItemId: string,
  contactIds: string[],
  db: Db = prisma,
): Promise<Prisma.BatchPayload> {
  return db.routeItemContact.deleteMany({ where: { routeItemId, contactId: { in: contactIds } } });
}

export function deleteAllRouteItemContacts(
  routeItemId: string,
  db: Db = prisma,
): Promise<Prisma.BatchPayload> {
  return db.routeItemContact.deleteMany({ where: { routeItemId } });
}

// --- Per-assignment execution (RouteItemExecution / RouteItemContactExecution) ---

export type RouteItemStatusValue = "PENDING" | "COMPLETED" | "CANCELLED";

// One assignee's completion state for one stop — created on first write,
// updated after. Absent means PENDING (the default every item starts at
// for every assignment, never written up front).
export function upsertItemExecution(
  routeItemId: string,
  routeAssignmentId: string,
  status: RouteItemStatusValue,
  actorId: string,
  db: Db = prisma,
): Promise<Prisma.RouteItemExecutionGetPayload<object>> {
  return db.routeItemExecution.upsert({
    where: { routeItemId_routeAssignmentId: { routeItemId, routeAssignmentId } },
    create: { routeItemId, routeAssignmentId, status, createdBy: actorId, updatedBy: actorId },
    update: { status, updatedBy: actorId },
  });
}

export function upsertContactExecution(
  routeItemContactId: string,
  routeAssignmentId: string,
  status: RouteItemStatusValue,
  actorId: string,
  db: Db = prisma,
): Promise<Prisma.RouteItemContactExecutionGetPayload<object>> {
  return db.routeItemContactExecution.upsert({
    where: { routeItemContactId_routeAssignmentId: { routeItemContactId, routeAssignmentId } },
    create: {
      routeItemContactId,
      routeAssignmentId,
      status,
      createdBy: actorId,
      updatedBy: actorId,
    },
    update: { status, updatedBy: actorId },
  });
}

// This one assignment's status for every Contact under one item — absent
// rows default to PENDING, same convention as the item-level execution.
export async function listContactStatusesForItem(
  routeItemId: string,
  routeAssignmentId: string,
  db: Db = prisma,
): Promise<RouteItemStatusValue[]> {
  const contacts = await db.routeItemContact.findMany({
    where: { routeItemId },
    select: {
      executions: { where: { routeAssignmentId }, select: { status: true } },
    },
  });
  return contacts.map((row) => row.executions[0]?.status ?? "PENDING");
}

// The ids of this item's Contacts that are still PENDING for this one
// assignment — used by cancelRouteItem so cancelling a center only cancels
// what's left for this assignee, never a contact that assignee (or anyone
// else) already completed.
export async function listPendingContactIdsForItem(
  routeItemId: string,
  routeAssignmentId: string,
  db: Db = prisma,
): Promise<string[]> {
  const contacts = await db.routeItemContact.findMany({
    where: { routeItemId },
    select: {
      id: true,
      executions: { where: { routeAssignmentId }, select: { status: true } },
    },
  });
  return contacts
    .filter((row) => (row.executions[0]?.status ?? "PENDING") === "PENDING")
    .map((row) => row.id);
}

// This one assignment's current status for one specific Contact — absent
// means PENDING, same convention as every other execution lookup. Used by
// completeRouteItemContact/cancelRouteItemContact to refuse acting on a
// contact that already has a final status for this assignment.
export async function findContactExecutionStatus(
  routeItemContactId: string,
  routeAssignmentId: string,
  db: Db = prisma,
): Promise<RouteItemStatusValue> {
  const row = await db.routeItemContactExecution.findUnique({
    where: {
      routeItemContactId_routeAssignmentId: { routeItemContactId, routeAssignmentId },
    },
    select: { status: true },
  });
  return row?.status ?? "PENDING";
}

// Every (item, contact) execution for one assignment that's still PENDING
// (or has no execution row at all, which defaults to PENDING) — the set
// cancelling an assignment needs to flip, without touching any other
// assignee's own progress on the same shared items.
export async function listPendingExecutionTargetsForAssignment(
  routeId: string,
  routeAssignmentId: string,
  db: Db = prisma,
): Promise<{
  itemIds: string[];
  itemsWithContactsIds: string[];
  contactIds: string[];
}> {
  const items = await db.routeItem.findMany({
    where: { routeId },
    select: {
      id: true,
      executions: { where: { routeAssignmentId }, select: { status: true } },
      contacts: {
        select: {
          id: true,
          executions: { where: { routeAssignmentId }, select: { status: true } },
        },
      },
    },
  });

  const itemIds: string[] = [];
  const itemsWithContactsIds: string[] = [];
  const contactIds: string[] = [];
  for (const item of items) {
    if (item.contacts.length > 0) {
      itemsWithContactsIds.push(item.id);
      for (const contact of item.contacts) {
        const status = contact.executions[0]?.status ?? "PENDING";
        if (status === "PENDING") contactIds.push(contact.id);
      }
    } else {
      const status = item.executions[0]?.status ?? "PENDING";
      if (status === "PENDING") itemIds.push(item.id);
    }
  }
  return { itemIds, itemsWithContactsIds, contactIds };
}

// The duplicate-prevention check (per-visitor, across all of that visitor's
// active assignments) — every center already actively planned (PENDING or
// COMPLETED for that assignment; CANCELLED doesn't count as "still
// planned") for this visitor in a range that overlaps [startDate, endDate],
// optionally excluding one route's own items (so checking a route against
// itself during assignment doesn't self-conflict).
export async function findActiveCenterIdsForVisitorInRange(
  visitorId: string,
  startDate: Date,
  endDate: Date,
  excludeRouteId?: string,
): Promise<Set<string>> {
  const assignments = await prisma.routeAssignment.findMany({
    where: {
      userId: visitorId,
      status: "ACTIVE",
      startDate: { lte: endDate },
      endDate: { gte: startDate },
      ...(excludeRouteId ? { routeId: { not: excludeRouteId } } : {}),
    },
    select: {
      id: true,
      route: {
        select: {
          items: {
            select: {
              id: true,
              centerId: true,
              contacts: { select: { id: true } },
              executions: { select: { routeAssignmentId: true, status: true } },
            },
          },
        },
      },
    },
  });

  const centerIds = new Set<string>();
  for (const assignment of assignments) {
    for (const item of assignment.route.items) {
      if (item.contacts.length > 0) {
        // A center with contacts has no item-level execution of its own —
        // "active" means at least one contact isn't CANCELLED for this
        // assignment, same derived-status rule used everywhere else.
        centerIds.add(item.centerId);
        continue;
      }
      const status =
        item.executions.find((e) => e.routeAssignmentId === assignment.id)?.status ?? "PENDING";
      if (status !== "CANCELLED") centerIds.add(item.centerId);
    }
  }
  return centerIds;
}
