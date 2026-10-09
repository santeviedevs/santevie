import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

const listInclude = {
  center: { select: { id: true, name: true, code: true } },
  territory: { select: { id: true, code: true } },
  owner: { select: { id: true, name: true } },
} satisfies Prisma.ActivityInclude;

export type ActivityRow = Prisma.ActivityGetPayload<{ include: typeof listInclude }>;

export function createActivityRow(data: Prisma.ActivityCreateInput): Promise<ActivityRow> {
  return prisma.activity.create({ data, include: listInclude });
}

export function findActivityById(id: string): Promise<ActivityRow | null> {
  return prisma.activity.findUnique({ where: { id }, include: listInclude });
}

export function updateActivityStatus(
  id: string,
  status: Prisma.ActivityUpdateInput["status"],
  actorId: string,
): Promise<ActivityRow> {
  return prisma.activity.update({
    where: { id },
    data: { status, updatedBy: actorId },
    include: listInclude,
  });
}

// Sets the assignee and moves the activity's still-PENDING follow-ups to
// them in the same transaction, so a reassignment never leaves follow-ups
// with the previous owner.
export async function assignActivityRow(
  id: string,
  ownerId: string,
  actorId: string,
): Promise<ActivityRow> {
  const [updated] = await prisma.$transaction([
    prisma.activity.update({
      where: { id },
      data: { ownerId, updatedBy: actorId },
      include: listInclude,
    }),
    prisma.followUp.updateMany({
      where: { activityId: id, status: "PENDING" },
      data: { ownerId, updatedBy: actorId },
    }),
  ]);
  return updated;
}

export type ActivityQuery = {
  // `undefined` means unrestricted (ADMIN) — same convention as
  // scopeUserIds in scope.ts.
  ownerIds: string[] | undefined;
  // Additionally returns activities with no assignee yet, but only ones
  // created by one of these users — an unassigned activity has no owner to
  // scope on, so the creator stands in for it.
  unassignedCreatorIds?: string[];
  unassignedOnly?: boolean;
  // Half-open date range [from, to), used by the calendar to load one month.
  from?: Date;
  to?: Date;
  skip?: number;
  take?: number;
};

function buildWhere(query: ActivityQuery): Prisma.ActivityWhereInput {
  const { ownerIds, unassignedCreatorIds } = query;

  const visibility: Prisma.ActivityWhereInput = !ownerIds
    ? {}
    : unassignedCreatorIds
      ? {
          OR: [
            { ownerId: { in: ownerIds } },
            { ownerId: null, createdBy: { in: unassignedCreatorIds } },
          ],
        }
      : { ownerId: { in: ownerIds } };

  // AND of independent conditions, not one spread object: `visibility` can
  // carry its own top-level `OR`, and spreading would let another clause
  // silently overwrite it.
  return {
    AND: [
      visibility,
      query.unassignedOnly ? { ownerId: null } : {},
      query.from || query.to ? { date: { gte: query.from, lt: query.to } } : {},
    ],
  };
}

export function listActivities(query: ActivityQuery): Promise<ActivityRow[]> {
  return prisma.activity.findMany({
    where: buildWhere(query),
    include: listInclude,
    orderBy: [{ date: "desc" }, { id: "asc" }],
    skip: query.skip,
    take: query.take,
  });
}

export function countActivities(query: ActivityQuery): Promise<number> {
  return prisma.activity.count({ where: buildWhere(query) });
}
