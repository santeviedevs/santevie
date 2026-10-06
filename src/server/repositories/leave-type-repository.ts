import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

export type LeaveTypeRow = Prisma.LeaveTypeGetPayload<Record<string, never>>;

// No status filter — LeaveType is a plain unstatused lookup, same as
// ClientType/ProductCategory.
export function listLeaveTypes(): Promise<LeaveTypeRow[]> {
  return prisma.leaveType.findMany({ orderBy: { name: "asc" } });
}

export function findLeaveTypeById(id: string): Promise<LeaveTypeRow | null> {
  return prisma.leaveType.findUnique({ where: { id } });
}
