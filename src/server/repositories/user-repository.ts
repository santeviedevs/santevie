import type { UserFilters } from "@/lib/schemas/user";
import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

const listInclude = {
  role: true,
  manager: { select: { id: true, name: true } },
  homeTerritory: { select: { id: true, name: true } },
} satisfies Prisma.UserInclude;

export type UserWithRelations = Prisma.UserGetPayload<{ include: typeof listInclude }>;

function buildWhere(filters: UserFilters): Prisma.UserWhereInput {
  return {
    ...(filters.roleId ? { roleId: filters.roleId } : {}),
    ...(filters.territoryId ? { homeTerritoryId: filters.territoryId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" } },
            { email: { contains: filters.q, mode: "insensitive" } },
            { employeeCode: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

// `scopedIds`, when present, restricts results to that id set — this is
// how src/server/scope.ts's hierarchy filter reaches the query. Absent
// means unrestricted, matching an ADMIN/MANAGER scope.
export function findUsers(
  filters: UserFilters,
  scopedIds?: string[],
): Promise<UserWithRelations[]> {
  return prisma.user.findMany({
    where: { ...buildWhere(filters), ...(scopedIds ? { id: { in: scopedIds } } : {}) },
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

export function deactivateUser(id: string): Promise<UserWithRelations> {
  return prisma.user.update({
    where: { id },
    data: { status: "INACTIVE" },
    include: listInclude,
  });
}

export function listRoleOptions() {
  return prisma.role.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}

export function listTerritoryOptions() {
  return prisma.territory.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
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
