import { toSkipTake } from "@/lib/pagination";
import type { HolidayFilters } from "@/lib/schemas/holiday";
import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

const holidayInclude = {
  territory: { select: { id: true, code: true } },
} satisfies Prisma.HolidayInclude;

export type HolidayRow = Prisma.HolidayGetPayload<{ include: typeof holidayInclude }>;

export function findHolidayById(id: string): Promise<HolidayRow | null> {
  return prisma.holiday.findUnique({ where: { id }, include: holidayInclude });
}

export function createHolidayRow(data: Prisma.HolidayCreateInput): Promise<HolidayRow> {
  return prisma.holiday.create({ data, include: holidayInclude });
}

export function updateHolidayRow(id: string, data: Prisma.HolidayUpdateInput): Promise<HolidayRow> {
  return prisma.holiday.update({ where: { id }, data, include: holidayInclude });
}

function buildHolidayWhere(filters: HolidayFilters): Prisma.HolidayWhereInput {
  return {
    ...(filters.territoryId ? { territoryId: filters.territoryId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.year
      ? {
          startDate: {
            gte: new Date(Date.UTC(filters.year, 0, 1)),
            lt: new Date(Date.UTC(filters.year + 1, 0, 1)),
          },
        }
      : {}),
  };
}

export function findHolidays(filters: HolidayFilters): Promise<HolidayRow[]> {
  return prisma.holiday.findMany({
    where: buildHolidayWhere(filters),
    include: holidayInclude,
    orderBy: { startDate: "asc" },
    ...toSkipTake(filters),
  });
}

export function countFilteredHolidays(filters: HolidayFilters): Promise<number> {
  return prisma.holiday.count({ where: buildHolidayWhere(filters) });
}

// isWorkingDay's holiday check — an ACTIVE holiday whose range contains
// `date`, matching either this territory specifically or every territory
// (territoryId: null).
export function findActiveHolidayCoveringDate(territoryId: string, date: Date) {
  return prisma.holiday.findFirst({
    where: {
      status: "ACTIVE",
      startDate: { lte: date },
      endDate: { gte: date },
      OR: [{ territoryId }, { territoryId: null }],
    },
    select: { id: true },
  });
}

// The Calendar screen's month view — every ACTIVE holiday (territory-specific
// or all-territory) intersecting [startDate, endDate], in one query rather
// than one findActiveHolidayCoveringDate call per day in the grid.
export function findHolidaysInRange(territoryId: string, startDate: Date, endDate: Date) {
  return prisma.holiday.findMany({
    where: {
      status: "ACTIVE",
      startDate: { lte: endDate },
      endDate: { gte: startDate },
      OR: [{ territoryId }, { territoryId: null }],
    },
    select: { name: true, startDate: true, endDate: true },
  });
}
