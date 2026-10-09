import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

const planInclude = {
  items: {
    include: { center: { select: { id: true, name: true, code: true, territoryId: true } } },
    orderBy: { sequence: "asc" },
  },
} satisfies Prisma.PlanInclude;

export type PlanWithItems = Prisma.PlanGetPayload<{ include: typeof planInclude }>;
export type PlanItemRow = Prisma.PlanItemGetPayload<object>;

export function createPlanRow(actorId: string): Promise<Prisma.PlanGetPayload<object>> {
  return prisma.plan.create({ data: { createdBy: actorId, updatedBy: actorId } });
}

export function findPlanById(id: string): Promise<PlanWithItems | null> {
  return prisma.plan.findUnique({ where: { id }, include: planInclude });
}

// Plan Visits (content) scope — every plan the actor may currently edit
// content on: their own still-unassigned drafts, plus any plan already
// assigned to someone in their downstream chain. `assignedUserIds`
// undefined means ADMIN — matches assertCanActOnPlan's own ADMIN bypass
// exactly: no restriction at all, every plan, including other actors'
// unassigned drafts (not just the ADMIN's own).
export function findEditablePlans(params: {
  creatorId: string;
  assignedUserIds: string[] | undefined;
}): Promise<PlanWithItems[]> {
  return prisma.plan.findMany({
    where: params.assignedUserIds
      ? {
          OR: [
            { userId: null, createdBy: params.creatorId },
            { userId: { in: params.assignedUserIds } },
          ],
        }
      : {},
    include: planInclude,
    orderBy: { createdAt: "desc" },
  });
}

// Assignment screen scope — same reach as findEditablePlans (the actor's
// own unassigned drafts, plus plans already assigned within their
// downstream chain) since assigning/reassigning/cancelling an assignment
// uses the identical authorization boundary as editing content.
export const findAssignablePlans = findEditablePlans;

export function findPlansForVisitor(visitorId: string): Promise<PlanWithItems[]> {
  return prisma.plan.findMany({
    where: { userId: visitorId },
    include: planInclude,
    orderBy: { date: "desc" },
  });
}

export function createPlanItem(data: Prisma.PlanItemCreateInput): Promise<PlanItemRow> {
  return prisma.planItem.create({ data });
}

export function findPlanItemById(
  id: string,
): Promise<(PlanItemRow & { plan: Prisma.PlanGetPayload<object> }) | null> {
  return prisma.planItem.findUnique({ where: { id }, include: { plan: true } });
}

export function deletePlanItem(id: string): Promise<PlanItemRow> {
  return prisma.planItem.delete({ where: { id } });
}

export function updatePlanItemSequence(
  id: string,
  sequence: number,
  actorId: string,
): Promise<PlanItemRow> {
  return prisma.planItem.update({ where: { id }, data: { sequence, updatedBy: actorId } });
}

export function updatePlanItemStatus(
  id: string,
  status: Prisma.PlanItemUpdateInput["status"],
  actorId: string,
): Promise<PlanItemRow> {
  return prisma.planItem.update({ where: { id }, data: { status, updatedBy: actorId } });
}

// Bulk-cancels every still-PENDING item under a plan — "cancel the
// assignment" (Assignment screen), not a per-item action.
export function cancelPendingPlanItems(
  planId: string,
  actorId: string,
): Promise<Prisma.BatchPayload> {
  return prisma.planItem.updateMany({
    where: { planId, status: "PENDING" },
    data: { status: "CANCELLED", updatedBy: actorId },
  });
}

// First-time assignment — sets userId/date in place on a currently-
// unassigned plan. Reassignment never calls this; it creates a new plan
// instead (see movePlanItemsToNewPlan + deletePlanRow below).
export function assignPlanRow(
  planId: string,
  userId: string,
  date: Date,
  actorId: string,
): Promise<Prisma.PlanGetPayload<object>> {
  return prisma.plan.update({
    where: { id: planId },
    data: { user: { connect: { id: userId } }, date, updatedBy: actorId },
  });
}

// Reassignment's actual move — repoints every item from the source plan
// onto a freshly created destination plan (createPlanRow + this +
// deletePlanRow, run by the service as one logical operation). Repointing
// the FK is simpler and just as correct as copying rows, since nothing
// else references a PlanItem's id externally.
export function movePlanItems(fromPlanId: string, toPlanId: string): Promise<Prisma.BatchPayload> {
  return prisma.planItem.updateMany({
    where: { planId: fromPlanId },
    data: { planId: toPlanId },
  });
}

export function deletePlanRow(id: string): Promise<Prisma.PlanGetPayload<object>> {
  return prisma.plan.delete({ where: { id } });
}

// The duplicate-prevention check (per-visitor, per-date, global across all
// of that visitor's plans) — every center already actively planned
// (PENDING or COMPLETED; CANCELLED doesn't count as "still planned") for
// this visitor on this date, across every plan, optionally excluding one
// plan's own items (so checking a plan against itself during assignment
// doesn't self-conflict).
export async function findActiveCenterIdsForVisitorOnDate(
  visitorId: string,
  date: Date,
  excludePlanId?: string,
): Promise<Set<string>> {
  const items = await prisma.planItem.findMany({
    where: {
      status: { in: ["PENDING", "COMPLETED"] },
      plan: { userId: visitorId, date, ...(excludePlanId ? { id: { not: excludePlanId } } : {}) },
    },
    select: { centerId: true },
  });
  return new Set(items.map((item) => item.centerId));
}
