import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

const assignmentInclude = {
  territory: {
    include: {
      province: { select: { id: true, name: true } },
      ville: { select: { id: true, name: true } },
      commune: { select: { id: true, name: true } },
      quartier: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.UserTerritoryAssignmentInclude;

export type TerritoryAssignmentRow = Prisma.UserTerritoryAssignmentGetPayload<{
  include: typeof assignmentInclude;
}>;

export function listAssignmentsForUser(userId: string): Promise<TerritoryAssignmentRow[]> {
  return prisma.userTerritoryAssignment.findMany({
    where: { userId },
    include: assignmentInclude,
    orderBy: { createdAt: "asc" },
  });
}

export function findAssignmentById(id: string) {
  return prisma.userTerritoryAssignment.findUnique({ where: { id } });
}

export function createAssignment(
  data: Prisma.UserTerritoryAssignmentCreateInput,
): Promise<TerritoryAssignmentRow> {
  return prisma.userTerritoryAssignment.create({ data, include: assignmentInclude });
}

export async function deleteAssignment(id: string): Promise<void> {
  await prisma.userTerritoryAssignment.delete({ where: { id } });
}
