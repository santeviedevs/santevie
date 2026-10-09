import { toSkipTake } from "@/lib/pagination";
import type { UserFilters } from "@/lib/schemas/user";
import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

const listInclude = {
  role: true,
  // Manager's own role is included alongside their name — the Team screen
  // shows it (S2-04: "Reports to Jane Doe (Supervisor)") so a Manager or
  // Admin scanning a flattened downstream list can tell which rows are
  // Supervisors versus Delegates without a separate lookup.
  manager: { select: { id: true, name: true, role: { select: { id: true, name: true } } } },
  territory: {
    select: {
      id: true,
      code: true,
      province: { select: { id: true, name: true } },
      ville: { select: { id: true, name: true } },
      commune: { select: { id: true, name: true } },
      quartier: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.UserInclude;

export type UserWithRelations = Prisma.UserGetPayload<{ include: typeof listInclude }>;

// `matchTerritoryAssignments`: the Team screen's territory filter means
// "who covers this territory" — true for a user whose *home* territoryId is
// it, or who merely holds an assignment there (S2-04's multi-territory
// join table). The admin Users screen keeps the narrower home-territory-only
// meaning, so this only widens the clause when the caller opts in.
// Built as an `AND` of independent conditions rather than spreading each
// into one object: the territory-assignment clause and the search clause
// are each their own `OR`, and spreading two objects that each have a
// top-level `OR` key would silently let the second overwrite the first.
function buildWhere(
  filters: UserFilters,
  options?: { matchTerritoryAssignments?: boolean },
): Prisma.UserWhereInput {
  const conditions: Prisma.UserWhereInput[] = [];

  if (filters.roleId) conditions.push({ roleId: filters.roleId });
  if (filters.managerId) conditions.push({ managerId: filters.managerId });
  if (filters.territoryId) {
    conditions.push(
      options?.matchTerritoryAssignments
        ? {
            OR: [
              { territoryId: filters.territoryId },
              { territoryAssignments: { some: { territoryId: filters.territoryId } } },
            ],
          }
        : { territoryId: filters.territoryId },
    );
  }
  if (filters.status) conditions.push({ status: filters.status });
  if (filters.q) {
    conditions.push({
      OR: [
        { name: { contains: filters.q, mode: "insensitive" } },
        { email: { contains: filters.q, mode: "insensitive" } },
        { employeeCode: { contains: filters.q, mode: "insensitive" } },
      ],
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

// `scopedIds`, when present, restricts results to that id set — this is
// how src/server/scope.ts's hierarchy filter reaches the query. Absent
// means unrestricted, matching an ADMIN/MANAGER scope.
export function findUsers(
  filters: UserFilters,
  scopedIds?: string[],
  options?: { matchTerritoryAssignments?: boolean },
): Promise<UserWithRelations[]> {
  return prisma.user.findMany({
    where: {
      ...buildWhere(filters, options),
      ...(scopedIds ? { id: { in: scopedIds } } : {}),
    },
    include: listInclude,
    orderBy: { name: "asc" },
    ...toSkipTake(filters),
  });
}

export function countUsers(
  filters: UserFilters,
  scopedIds?: string[],
  options?: { matchTerritoryAssignments?: boolean },
): Promise<number> {
  return prisma.user.count({
    where: {
      ...buildWhere(filters, options),
      ...(scopedIds ? { id: { in: scopedIds } } : {}),
    },
  });
}

// Every user in scope, unpaginated — used to derive filter-dropdown options
// (Team's Reports-To list) from the *complete* downstream set, never just
// the current page. Never used for a list screen's row data itself, so the
// hard page-size ceiling doesn't apply here: this reads one manager's
// downstream org, not an unbounded table scan.
export function findAllUsersInScope(scopedIds?: string[]): Promise<UserWithRelations[]> {
  return prisma.user.findMany({
    where: scopedIds ? { id: { in: scopedIds } } : {},
    include: listInclude,
    orderBy: { name: "asc" },
  });
}

export function findUserById(id: string, scopedIds?: string[]): Promise<UserWithRelations | null> {
  if (scopedIds && !scopedIds.includes(id)) {
    return Promise.resolve(null);
  }
  return prisma.user.findUnique({ where: { id }, include: listInclude });
}

// Id -> managerId for every user, used by the service to detect a manager
// cycle before it's written. Small, fixed-shape rows, so one query for the
// whole table is cheap and simpler than a recursive query per check.
export function findManagerLinks(): Promise<{ id: string; managerId: string | null }[]> {
  return prisma.user.findMany({ select: { id: true, managerId: true } });
}

export function createUser(data: Prisma.UserCreateInput): Promise<UserWithRelations> {
  return prisma.user.create({ data, include: listInclude });
}

export function updateUser(id: string, data: Prisma.UserUpdateInput): Promise<UserWithRelations> {
  return prisma.user.update({ where: { id }, data, include: listInclude });
}

export function listRoleOptions() {
  return prisma.role.findMany({
    select: { id: true, name: true, requiresLocation: true },
    orderBy: { name: "asc" },
  });
}

// Candidate managers: active users other than the one being edited.
export function listManagerOptions(excludeUserId?: string) {
  return prisma.user.findMany({
    where: { status: "ACTIVE", ...(excludeUserId ? { id: { not: excludeUserId } } : {}) },
    select: { id: true, name: true, employeeCode: true },
    orderBy: { name: "asc" },
  });
}

// Delegate picker for the Assign Territories screen — every active user,
// named separately from listManagerOptions even though the query is
// identical with no exclusion, since the two lists mean different things to
// a caller even when they happen to return the same rows today.
export function listActiveUserOptions() {
  return listManagerOptions();
}

// Every active user in a manager-capable role (Admin/Manager/Supervisor,
// i.e. whichever role ids the caller passes) — the Team screen's Reports-To
// picker, when no Role filter narrows it to only currently-managing
// accounts. Unlike listAssignmentsForUser-style downstream queries, this is
// unscoped by any manager chain: a Manager with zero current reports still
// shows up, since the point is letting the viewer pre-filter by someone
// before they've been assigned a team.
// S3-06's "assigned by" display on a route item — createdBy is a plain
// audit-column id (no relation), and may reference a now-deactivated user,
// so this deliberately doesn't filter by status the way listActiveUserOptions
// does.
export function findUsersByIds(ids: string[]) {
  return prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
}

// Ids of every user holding `roleName`, active or not — used to recognise a
// record an admin created (createdBy is a plain id with no relation), which
// may well outlive that admin's account being deactivated.
export async function findUserIdsByRoleName(roleName: string): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { role: { name: roleName } },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

export function listUsersByRoleIds(roleIds: string[]) {
  return prisma.user.findMany({
    where: { status: "ACTIVE", roleId: { in: roleIds } },
    select: { id: true, name: true, role: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
}
