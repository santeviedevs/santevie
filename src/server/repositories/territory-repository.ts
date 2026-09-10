import type { TerritoryFilters } from "@/lib/schemas/territory";
import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

export type TerritoryRow = Prisma.TerritoryGetPayload<Record<string, never>>;

function buildWhere(filters: TerritoryFilters): Prisma.TerritoryWhereInput {
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" } },
            { code: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export function findTerritories(filters: TerritoryFilters): Promise<TerritoryRow[]> {
  return prisma.territory.findMany({
    where: buildWhere(filters),
    orderBy: { name: "asc" },
  });
}

export function findTerritoryById(id: string): Promise<TerritoryRow | null> {
  return prisma.territory.findUnique({ where: { id } });
}

export function createTerritory(data: Prisma.TerritoryCreateInput): Promise<TerritoryRow> {
  return prisma.territory.create({ data });
}

export function updateTerritory(
  id: string,
  data: Prisma.TerritoryUpdateInput,
): Promise<TerritoryRow> {
  return prisma.territory.update({ where: { id }, data });
}

export function setTerritoryStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE",
  actorId: string,
): Promise<TerritoryRow> {
  return prisma.territory.update({
    where: { id },
    data: { status, updatedBy: actorId },
  });
}

// Counts backing the deactivation guard: a territory with any active user or
// client assigned must not be deactivated, or those records would point at
// a territory no longer selectable for new work.
export async function countActiveAssignments(
  territoryId: string,
): Promise<{ activeUsers: number; activeClients: number }> {
  const [activeUsers, activeClients] = await Promise.all([
    prisma.user.count({ where: { homeTerritoryId: territoryId, status: "ACTIVE" } }),
    prisma.client.count({ where: { territoryId, status: "ACTIVE" } }),
  ]);
  return { activeUsers, activeClients };
}
