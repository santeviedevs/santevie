import { toSkipTake } from "@/lib/pagination";
import type { AttendanceReportFilters } from "@/lib/schemas/attendance-report";
import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

const listInclude = {
  user: {
    select: {
      id: true,
      name: true,
      employeeCode: true,
      territory: { select: { id: true, code: true } },
    },
  },
  sessions: { orderBy: { checkInAt: "asc" } },
} satisfies Prisma.AttendanceInclude;

export type AttendanceReportRow = Prisma.AttendanceGetPayload<{ include: typeof listInclude }>;

// `userIds: undefined` means unrestricted — but this is the *already
// fully-resolved* set the caller may see, not a scope to merge with
// anything else. attendance-report-service.ts is responsible for
// intersecting the viewer's hierarchy scope with any employeeId filter
// *before* calling this (an out-of-scope employeeId must resolve to an
// empty list there, never arrive here to be merged against a wider
// scope — that merge is exactly how a hierarchy filter gets silently
// dropped).
function buildWhere(
  filters: AttendanceReportFilters,
  userIds: string[] | undefined,
): Prisma.AttendanceWhereInput {
  // Combined into one `user` object deliberately — two separate spreads
  // each keyed `user` would let the second silently overwrite the first
  // rather than both conditions applying together (same pitfall noted in
  // client-repository.ts's buildWhere).
  const userCondition: Prisma.AttendanceWhereInput["user"] = {
    ...(userIds ? { id: { in: userIds } } : {}),
    ...(filters.territoryId ? { territoryId: filters.territoryId } : {}),
  };

  return {
    ...(Object.keys(userCondition).length > 0 ? { user: userCondition } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          date: {
            ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
            ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
          },
        }
      : {}),
  };
}

export function findAttendanceById(id: string): Promise<AttendanceReportRow | null> {
  return prisma.attendance.findUnique({ where: { id }, include: listInclude });
}

export function findAttendanceRecords(
  filters: AttendanceReportFilters,
  userIds: string[] | undefined,
): Promise<AttendanceReportRow[]> {
  return prisma.attendance.findMany({
    where: buildWhere(filters, userIds),
    include: listInclude,
    orderBy: { date: "desc" },
    ...toSkipTake(filters),
  });
}

export function countAttendanceRecords(
  filters: AttendanceReportFilters,
  userIds: string[] | undefined,
): Promise<number> {
  return prisma.attendance.count({ where: buildWhere(filters, userIds) });
}

// The daily team roster — every resolved-scope user's attendance row for
// one exact date, regardless of the paginated filters above.
export function findAttendanceForDate(
  date: Date,
  userIds: string[] | undefined,
): Promise<AttendanceReportRow[]> {
  return prisma.attendance.findMany({
    where: { date, ...(userIds ? { user: { id: { in: userIds } } } : {}) },
    include: listInclude,
    orderBy: { user: { name: "asc" } },
  });
}
