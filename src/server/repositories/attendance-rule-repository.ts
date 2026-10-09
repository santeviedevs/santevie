import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

export type AttendanceRuleRow = Prisma.AttendanceRuleGetPayload<Record<string, never>>;

// Insert-only — see the model comment in schema.prisma. There is
// deliberately no update function here; a change is always a new row.
export function createAttendanceRuleRow(
  data: Prisma.AttendanceRuleCreateInput,
): Promise<AttendanceRuleRow> {
  return prisma.attendanceRule.create({ data });
}

// Every rule that could possibly apply to `targetUserId` on some business
// date: an individual override for them specifically, a territory rule for
// any of their assigned territories, a team rule owned by anyone in their
// upward manager chain, or the global default (all three scope columns
// null). The caller (attendance-rule-service.ts) filters this down to rows
// valid as of a specific business date and picks the newest — this just
// gathers the full candidate pool, already newest-first so the common case
// (resolving "today") needs no further sort.
export function findCandidateRules(params: {
  targetUserId: string;
  territoryIds: string[];
  ownerIds: string[];
}): Promise<AttendanceRuleRow[]> {
  return prisma.attendanceRule.findMany({
    where: {
      OR: [
        { targetUserId: params.targetUserId },
        ...(params.territoryIds.length > 0 ? [{ territoryId: { in: params.territoryIds } }] : []),
        ...(params.ownerIds.length > 0 ? [{ ownerId: { in: params.ownerIds } }] : []),
        { territoryId: null, ownerId: null, targetUserId: null },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
}

const listInclude = {
  territory: { select: { id: true, code: true } },
  owner: { select: { id: true, name: true } },
  targetUser: { select: { id: true, name: true } },
} satisfies Prisma.AttendanceRuleInclude;

export type AttendanceRuleListRow = Prisma.AttendanceRuleGetPayload<{
  include: typeof listInclude;
}>;

// The admin/manager/supervisor "Attendance Rules" screen's list — every
// version (not just the currently-active one per target), newest first, so
// the history itself is visible. `where` is built by the service layer from
// the viewer's scope (ADMIN gets no filter; MANAGER/SUPERVISOR get an OR of
// their own downstream territory/ownership reach).
export function listAttendanceRules(
  where: Prisma.AttendanceRuleWhereInput,
): Promise<AttendanceRuleListRow[]> {
  return prisma.attendanceRule.findMany({
    where,
    include: listInclude,
    orderBy: { createdAt: "desc" },
  });
}
