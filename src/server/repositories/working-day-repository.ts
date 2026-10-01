import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

export type WorkingDayRow = Prisma.TerritoryWorkingDayGetPayload<Record<string, never>>;

export function listWorkingDays(territoryId: string): Promise<WorkingDayRow[]> {
  return prisma.territoryWorkingDay.findMany({
    where: { territoryId },
    orderBy: { dayOfWeek: "asc" },
  });
}

// isWorkingDay's weekly-config check for a single day.
export function findWorkingDay(
  territoryId: string,
  dayOfWeek: number,
): Promise<WorkingDayRow | null> {
  return prisma.territoryWorkingDay.findUnique({
    where: { territoryId_dayOfWeek: { territoryId, dayOfWeek } },
  });
}

// Called right after a Territory row is created (see
// findOrCreateTerritory in territory-service.ts) — 7 rows, Mon-Sat working /
// Sunday off, so isWorkingDay always has something to read for a freshly
// created territory. dayOfWeek follows Date#getUTCDay() (0 = Sunday .. 6 =
// Saturday).
export function createDefaultWorkingDays(
  territoryId: string,
  actorId: string,
): Promise<Prisma.BatchPayload> {
  return prisma.territoryWorkingDay.createMany({
    data: Array.from({ length: 7 }, (_, dayOfWeek) => ({
      territoryId,
      dayOfWeek,
      isWorking: dayOfWeek !== 0,
      createdBy: actorId,
      updatedBy: actorId,
    })),
  });
}

export function upsertWorkingDay(
  territoryId: string,
  dayOfWeek: number,
  isWorking: boolean,
  actorId: string,
): Promise<WorkingDayRow> {
  return prisma.territoryWorkingDay.upsert({
    where: { territoryId_dayOfWeek: { territoryId, dayOfWeek } },
    update: { isWorking, updatedBy: actorId },
    create: { territoryId, dayOfWeek, isWorking, createdBy: actorId, updatedBy: actorId },
  });
}
