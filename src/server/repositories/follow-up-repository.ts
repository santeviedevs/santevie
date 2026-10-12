import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

const listInclude = {
  assignment: {
    select: {
      id: true,
      userId: true,
      scheduledDate: true,
      activity: {
        select: {
          id: true,
          name: true,
          type: true,
          center: { select: { id: true, name: true } },
          territory: { select: { id: true, code: true } },
        },
      },
    },
  },
} satisfies Prisma.FollowUpInclude;

export type FollowUpRow = Prisma.FollowUpGetPayload<{ include: typeof listInclude }>;

export function createFollowUpRow(data: Prisma.FollowUpCreateInput): Promise<FollowUpRow> {
  return prisma.followUp.create({ data, include: listInclude });
}

export function findFollowUpById(id: string): Promise<FollowUpRow | null> {
  return prisma.followUp.findUnique({ where: { id }, include: listInclude });
}

export function completeFollowUpRow(id: string, actorId: string): Promise<FollowUpRow> {
  return prisma.followUp.update({
    where: { id },
    data: { status: "DONE", updatedBy: actorId },
    include: listInclude,
  });
}

// Every PENDING follow-up raised against this one user's assignments,
// regardless of due date — the caller (follow-up-service.ts) splits this
// into "pending" vs "overdue" relative to the business date it's asked
// about, rather than this query baking in a notion of "today" itself.
export function findPendingFollowUpsForUser(userId: string): Promise<FollowUpRow[]> {
  return prisma.followUp.findMany({
    where: { status: "PENDING", assignment: { userId } },
    include: listInclude,
    orderBy: { dueDate: "asc" },
  });
}

// `userIds: undefined` means unrestricted (ADMIN).
export function findPendingFollowUps(userIds: string[] | undefined): Promise<FollowUpRow[]> {
  return prisma.followUp.findMany({
    where: {
      status: "PENDING",
      ...(userIds ? { assignment: { userId: { in: userIds } } } : {}),
    },
    include: listInclude,
    orderBy: { dueDate: "asc" },
  });
}
