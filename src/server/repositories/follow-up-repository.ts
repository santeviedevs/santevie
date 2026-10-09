import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

const listInclude = {
  activity: {
    select: {
      id: true,
      type: true,
      date: true,
      client: { select: { id: true, name: true } },
      territory: { select: { id: true, code: true } },
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

// Every PENDING follow-up owned by `ownerId`, regardless of due date — the
// caller (follow-up-service.ts) splits this into "pending" vs "overdue"
// relative to the business date it's asked about, rather than this query
// baking in a notion of "today" itself.
export function findPendingFollowUpsForOwner(ownerId: string): Promise<FollowUpRow[]> {
  return prisma.followUp.findMany({
    where: { ownerId, status: "PENDING" },
    include: listInclude,
    orderBy: { dueDate: "asc" },
  });
}

// `ownerIds: undefined` means unrestricted (ADMIN).
export function findPendingFollowUps(ownerIds: string[] | undefined): Promise<FollowUpRow[]> {
  return prisma.followUp.findMany({
    where: { status: "PENDING", ...(ownerIds ? { ownerId: { in: ownerIds } } : {}) },
    include: listInclude,
    orderBy: { dueDate: "asc" },
  });
}
