import { toSkipTake } from "@/lib/pagination";
import type { LeaveFilters } from "@/lib/schemas/leave";
import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

const leaveInclude = {
  user: { select: { id: true, name: true, employeeCode: true, managerId: true } },
  leaveType: { select: { id: true, name: true } },
} satisfies Prisma.LeaveInclude;

export type LeaveRow = Prisma.LeaveGetPayload<{ include: typeof leaveInclude }>;

export function findLeaveById(id: string): Promise<LeaveRow | null> {
  return prisma.leave.findUnique({ where: { id }, include: leaveInclude });
}

export function createLeaveRow(data: Prisma.LeaveCreateInput): Promise<LeaveRow> {
  return prisma.leave.create({ data, include: leaveInclude });
}

export function updateLeaveRow(id: string, data: Prisma.LeaveUpdateInput): Promise<LeaveRow> {
  return prisma.leave.update({ where: { id }, data, include: leaveInclude });
}

function buildLeaveWhere(
  filters: LeaveFilters,
  userIds: readonly string[] | undefined,
): Prisma.LeaveWhereInput {
  return {
    ...(userIds ? { userId: { in: [...userIds] } } : {}),
    ...(filters.leaveTypeId ? { leaveTypeId: filters.leaveTypeId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.from ? { endDate: { gte: new Date(filters.from) } } : {}),
    ...(filters.to ? { startDate: { lte: new Date(filters.to) } } : {}),
    // Leave has no territoryId of its own — filtered through the requester's
    // own territory instead, the same relation the Team screen's territory
    // filter already reads (S2-04).
    ...(filters.territoryId ? { user: { territoryId: filters.territoryId } } : {}),
  };
}

// userIds is the scope filter (own id only for My Leaves, the downstream
// team for Team Leaves) — undefined means unrestricted, matching how
// scopeUserIds() already treats an "all" scope elsewhere in the app.
export function findLeaves(
  filters: LeaveFilters,
  userIds: readonly string[] | undefined,
): Promise<LeaveRow[]> {
  return prisma.leave.findMany({
    where: buildLeaveWhere(filters, userIds),
    include: leaveInclude,
    orderBy: { startDate: "desc" },
    ...toSkipTake(filters),
  });
}

export function countFilteredLeaves(
  filters: LeaveFilters,
  userIds: readonly string[] | undefined,
): Promise<number> {
  return prisma.leave.count({ where: buildLeaveWhere(filters, userIds) });
}

// The overlap guard for applyLeave — any existing leave in `statuses` whose
// range intersects [startDate, endDate]. Two ranges intersect exactly when
// each one's start is on or before the other's end.
export function findOverlappingLeave(
  userId: string,
  startDate: Date,
  endDate: Date,
  statuses: readonly ("PENDING" | "APPROVED" | "REJECTED")[],
) {
  return prisma.leave.findFirst({
    where: {
      userId,
      status: { in: [...statuses] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { id: true },
  });
}

// isWorkingDay's leave check — an APPROVED leave for this user whose range
// contains `date`. Pending/Rejected never affect working-day determination.
export function findApprovedLeaveCoveringDate(userId: string, date: Date) {
  return prisma.leave.findFirst({
    where: {
      userId,
      status: "APPROVED",
      startDate: { lte: date },
      endDate: { gte: date },
    },
    select: { id: true },
  });
}

// The Calendar screen's month view — every leave (any status; the viewer
// should see their own Pending/Rejected requests on the calendar too, not
// just Approved ones) for this user overlapping [startDate, endDate].
// Deliberately separate from the paginated findLeaves above — a month has
// few enough rows that pagination is unneeded overhead here.
export function findLeavesOverlappingRange(userId: string, startDate: Date, endDate: Date) {
  return prisma.leave.findMany({
    where: {
      userId,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: {
      startDate: true,
      endDate: true,
      status: true,
      leaveType: { select: { name: true } },
    },
  });
}
