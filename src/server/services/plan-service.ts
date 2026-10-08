import { isPlanEditable } from "@/lib/schemas/plan";
import { findClientById } from "@/server/repositories/client-repository";
import {
  assignPlanRow,
  cancelPendingPlanItems,
  createPlanItem,
  createPlanRow,
  deletePlanItem,
  deletePlanRow,
  findActiveClientIdsForVisitorOnDate,
  findAssignablePlans,
  findEditablePlans,
  findPlanById,
  findPlanItemById,
  findPlansForVisitor,
  movePlanItems,
  type PlanWithItems,
  updatePlanItemSequence,
  updatePlanItemStatus,
} from "@/server/repositories/plan-repository";
import { listAssignmentsForUser } from "@/server/repositories/territory-assignment-repository";
import { findUserById, findUsersByIds } from "@/server/repositories/user-repository";
import { getDownstreamUserIds } from "@/server/scope";

export class PlanEditCutoffError extends Error {
  constructor() {
    super("This plan's date has already started, so it can no longer be edited.");
    this.name = "PlanEditCutoffError";
  }
}

export class ClientOutsideTerritoryError extends Error {
  constructor() {
    super("One or more clients are outside the visitor's permitted territories.");
    this.name = "ClientOutsideTerritoryError";
  }
}

export class DuplicateClientOnPlanError extends Error {
  constructor() {
    super("This client is already planned for this visitor on this date.");
    this.name = "DuplicateClientOnPlanError";
  }
}

// Thrown by content actions (add/remove/reorder) and by cancelling an
// assignment — the actor must be the plan's creator (while unassigned), the
// visitor themselves (once assigned), or an ADMIN/MANAGER/SUPERVISOR with
// the visitor in their downstream chain.
export class PlanNotAuthorizedError extends Error {
  constructor() {
    super("You can only act on your own plan, or a plan for someone in your downstream team.");
    this.name = "PlanNotAuthorizedError";
  }
}

// completePlanItem specifically — only the visitor themselves, never an
// assignor, not even ADMIN.
export class PlanNotOwnedError extends Error {
  constructor() {
    super("Only the assigned visitor can mark a visit completed.");
    this.name = "PlanNotOwnedError";
  }
}

export class ClientNotFoundError extends Error {
  constructor() {
    super("Client not found.");
    this.name = "ClientNotFoundError";
  }
}

// Whole-plan reassign is only offered while every item is still PENDING —
// once anything's been completed, that history can't move with it.
export class PlanHasCompletedItemsError extends Error {
  constructor() {
    super("This plan already has completed visits, so it can no longer be reassigned as a whole.");
    this.name = "PlanHasCompletedItemsError";
  }
}

const ASSIGN_CAPABLE_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

// The one authorization rule for every content-level and assignment-level
// action: the plan's creator (only meaningful while it's still
// unassigned), the visitor themselves (once assigned), or anyone with
// assign-team capability who has the visitor in their downstream chain.
// ADMIN always passes.
async function assertCanActOnPlan(
  plan: { userId: string | null; createdBy: string | null },
  actorId: string,
  actorRoleName: string,
): Promise<void> {
  if (actorRoleName === "ADMIN") return;

  if (plan.userId === null) {
    if (plan.createdBy === actorId) return;
    throw new PlanNotAuthorizedError();
  }

  if (plan.userId === actorId) return;
  if (!ASSIGN_CAPABLE_ROLES.has(actorRoleName)) throw new PlanNotAuthorizedError();

  const downstream = await getDownstreamUserIds(actorId);
  if (!downstream.includes(plan.userId)) throw new PlanNotAuthorizedError();
}

export type PlanItemSummary = {
  id: string;
  sequence: number;
  // PENDING/COMPLETED/CANCELLED as actually stored; MISSED is never
  // stored — see the PlanItemStatus enum comment in schema.prisma.
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "MISSED";
  client: { id: string; name: string; code: string; territoryId: string | null };
};

export type PlanGroupSummary = {
  id: string;
  userId: string | null;
  visitorName: string | null;
  date: Date | null;
  editable: boolean;
  createdBy: string | null;
  createdByName: string | null;
  items: PlanItemSummary[];
};

function itemDisplayStatus(
  status: "PENDING" | "COMPLETED" | "CANCELLED",
  date: Date | null,
): PlanItemSummary["status"] {
  if (status !== "PENDING" || !date) return status;
  const now = new Date();
  const todayUtcMidnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  return date.getTime() < todayUtcMidnight.getTime() ? "MISSED" : "PENDING";
}

async function toGroupSummaries(plans: PlanWithItems[]): Promise<PlanGroupSummary[]> {
  const nameIds = [
    ...new Set(
      plans
        .flatMap((plan) => [plan.userId, plan.createdBy])
        .filter((id): id is string => id !== null),
    ),
  ];
  const users = nameIds.length > 0 ? await findUsersByIds(nameIds) : [];
  const nameById = new Map(users.map((user) => [user.id, user.name]));

  return plans.map((plan) => ({
    id: plan.id,
    userId: plan.userId,
    visitorName: plan.userId ? (nameById.get(plan.userId) ?? null) : null,
    date: plan.date,
    editable: isPlanEditable(plan.date),
    createdBy: plan.createdBy,
    createdByName: plan.createdBy ? (nameById.get(plan.createdBy) ?? null) : null,
    items: plan.items.map((item) => ({
      id: item.id,
      sequence: item.sequence,
      status: itemDisplayStatus(item.status, plan.date),
      client: {
        id: item.client.id,
        name: item.client.name,
        code: item.client.code,
        territoryId: item.client.territoryId,
      },
    })),
  }));
}

// The visitor's (or creator's, while unassigned) permitted territories —
// home territory plus every UserTerritoryAssignment row (S2-04's
// multi-territory model).
export async function getPermittedTerritoryIds(userId: string): Promise<Set<string>> {
  const [user, assignments] = await Promise.all([
    findUserById(userId),
    listAssignmentsForUser(userId),
  ]);
  const ids = new Set<string>(assignments.map((assignment) => assignment.territoryId));
  if (user?.territoryId) ids.add(user.territoryId);
  return ids;
}

// Plan Visits (content) — the actor's own unassigned drafts, plus any
// plan already assigned within their downstream chain.
export async function getPlansForContent(
  actorId: string,
  actorRoleName: string,
): Promise<PlanGroupSummary[]> {
  const assignedUserIds =
    actorRoleName === "ADMIN" ? undefined : await getDownstreamUserIds(actorId);
  const plans = await findEditablePlans({ creatorId: actorId, assignedUserIds });
  return toGroupSummaries(plans);
}

// Assignment — identical reach as Plan Visits (same authorization
// boundary governs both content edits and assign/reassign/cancel).
export async function getPlansForAssignment(
  actorId: string,
  actorRoleName: string,
): Promise<PlanGroupSummary[]> {
  const assignedUserIds =
    actorRoleName === "ADMIN" ? undefined : await getDownstreamUserIds(actorId);
  const plans = await findAssignablePlans({ creatorId: actorId, assignedUserIds });
  return toGroupSummaries(plans);
}

// My Visits — every plan currently assigned to this visitor, regardless of
// who created or assigned it.
export async function getMyVisits(visitorId: string): Promise<PlanGroupSummary[]> {
  const plans = await findPlansForVisitor(visitorId);
  return toGroupSummaries(plans);
}

export async function listAssignableUsers(
  actorId: string,
): Promise<{ id: string; name: string }[]> {
  const downstream = await getDownstreamUserIds(actorId);
  const users = await findUsersByIds([actorId, ...downstream]);
  return users.sort((a, b) =>
    a.id === actorId ? -1 : b.id === actorId ? 1 : a.name.localeCompare(b.name),
  );
}

export async function reorderPlanItems(
  planId: string,
  orderedPlanItemIds: string[],
  actorId: string,
  actorRoleName: string,
): Promise<void> {
  const plan = await findPlanById(planId);
  if (!plan) return;
  await assertCanActOnPlan(plan, actorId, actorRoleName);
  // Deliberately NOT gated by isPlanEditable — sequence-only, not a
  // content change; see my-visits-board.tsx / plan-visits-board.tsx.

  await Promise.all(
    orderedPlanItemIds.map((itemId, index) => updatePlanItemSequence(itemId, index, actorId)),
  );
}

// The single "Save" action on the Plan Visits editor — nothing about a
// plan's content is written until this runs. Takes the editor's whole
// desired client list (in order) and diffs it against what's actually
// stored: clients no longer in the list get removed, new ones get
// created, everyone kept gets resequenced to match. `planId: null` covers
// a brand-new plan — created here, in the same call, only once there's
// actually something to save (so "New plan" never leaves a bare, empty
// row sitting on Plan Visits/Assignment before the user has chosen
// anything). COMPLETED/CANCELLED items are never touched by the diff —
// only PENDING/MISSED ones are ever part of the editable set.
export async function savePlanContent(
  planId: string | null,
  clientIdsInOrder: string[],
  actorId: string,
  actorRoleName: string,
): Promise<string> {
  const plan = planId ? await findPlanById(planId) : null;
  if (planId && !plan) throw new PlanNotAuthorizedError();

  if (plan) {
    await assertCanActOnPlan(plan, actorId, actorRoleName);
    if (!isPlanEditable(plan.date)) throw new PlanEditCutoffError();
  }

  const territoryOwnerId = plan ? (plan.userId ?? plan.createdBy) : actorId;
  const permittedTerritoryIds = territoryOwnerId
    ? await getPermittedTerritoryIds(territoryOwnerId)
    : new Set<string>();

  const editableExistingItems = (plan?.items ?? []).filter((item) => item.status === "PENDING");
  const existingClientIds = new Set(editableExistingItems.map((item) => item.client.id));
  const keepClientIds = new Set(clientIdsInOrder.filter((id) => existingClientIds.has(id)));
  const toRemove = editableExistingItems.filter((item) => !keepClientIds.has(item.client.id));
  const toAddClientIds = clientIdsInOrder.filter((id) => !existingClientIds.has(id));

  const clientsToAdd = await Promise.all(toAddClientIds.map((id) => findClientById(id)));
  for (const client of clientsToAdd) {
    if (!client) throw new ClientNotFoundError();
    if (!client.territoryId || !permittedTerritoryIds.has(client.territoryId)) {
      throw new ClientOutsideTerritoryError();
    }
  }

  if (plan?.userId && plan.date) {
    const activeElsewhere = await findActiveClientIdsForVisitorOnDate(
      plan.userId,
      plan.date,
      plan.id,
    );
    if (toAddClientIds.some((id) => activeElsewhere.has(id))) {
      throw new DuplicateClientOnPlanError();
    }
  }

  const resolvedPlanId = plan?.id ?? (await createPlanRow(actorId)).id;

  await Promise.all(toRemove.map((item) => deletePlanItem(item.id)));

  const existingByClientId = new Map(editableExistingItems.map((item) => [item.client.id, item]));
  await Promise.all(
    clientIdsInOrder.map(async (clientId, sequence) => {
      const existing = existingByClientId.get(clientId);
      if (existing) {
        await updatePlanItemSequence(existing.id, sequence, actorId);
        return;
      }
      await createPlanItem({
        plan: { connect: { id: resolvedPlanId } },
        client: { connect: { id: clientId } },
        sequence,
        createdBy: actorId,
        updatedBy: actorId,
      });
    }),
  );

  return resolvedPlanId;
}

// Strictly the visitor themselves — no chain exception, not even ADMIN.
// Deliberately not gated by isPlanEditable: a visit is normally completed
// on or after its own date, exactly when content editing has locked.
export async function completePlanItem(planItemId: string, actorId: string): Promise<void> {
  const item = await findPlanItemById(planItemId);
  if (!item) return;
  if (item.plan.userId !== actorId) throw new PlanNotOwnedError();

  await updatePlanItemStatus(planItemId, "COMPLETED", actorId);
}

// Visitor or anyone with assign-team capability in their upward chain —
// only meaningful once a plan is assigned (an unassigned item has no
// visitor-level "cancel" claim; remove it via Plan Visits instead).
export async function cancelPlanItem(
  planItemId: string,
  actorId: string,
  actorRoleName: string,
): Promise<void> {
  const item = await findPlanItemById(planItemId);
  if (!item) return;
  if (item.plan.userId === null) throw new PlanNotAuthorizedError();
  await assertCanActOnPlan(item.plan, actorId, actorRoleName);

  await updatePlanItemStatus(planItemId, "CANCELLED", actorId);
}

async function assertTargetInReach(
  targetUserId: string,
  actorId: string,
  actorRoleName: string,
): Promise<void> {
  if (actorRoleName === "ADMIN" || actorId === targetUserId) return;
  if (!ASSIGN_CAPABLE_ROLES.has(actorRoleName)) throw new PlanNotAuthorizedError();

  const downstream = await getDownstreamUserIds(actorId);
  if (!downstream.includes(targetUserId)) throw new PlanNotAuthorizedError();
}

async function assertItemsFitTerritoryAndNoDuplicates(
  plan: PlanWithItems,
  targetUserId: string,
  date: Date,
): Promise<void> {
  const [permittedTerritoryIds, activeElsewhere] = await Promise.all([
    getPermittedTerritoryIds(targetUserId),
    findActiveClientIdsForVisitorOnDate(targetUserId, date, plan.id),
  ]);

  for (const item of plan.items) {
    if (!item.client.territoryId || !permittedTerritoryIds.has(item.client.territoryId)) {
      throw new ClientOutsideTerritoryError();
    }
    if (activeElsewhere.has(item.client.id)) {
      throw new DuplicateClientOnPlanError();
    }
  }
}

// Covers both first-time assignment (plan currently unassigned — updates
// in place) and reassignment (plan already assigned to someone else —
// creates a brand-new plan for the new visitor, moves every item onto it,
// and deletes the now-empty source; never merges into a plan the new
// visitor already happens to have that day, per the user's explicit
// decision that visitors can hold several independent plans per date).
export async function assignPlan(
  planId: string,
  targetUserId: string,
  date: Date,
  actorId: string,
  actorRoleName: string,
): Promise<string> {
  const plan = await findPlanById(planId);
  if (!plan) throw new PlanNotAuthorizedError();

  await assertTargetInReach(targetUserId, actorId, actorRoleName);
  await assertItemsFitTerritoryAndNoDuplicates(plan, targetUserId, date);

  if (plan.userId === null) {
    await assignPlanRow(planId, targetUserId, date, actorId);
    return planId;
  }

  // Reassignment — only valid while every item is still PENDING or
  // CANCELLED; completed history can't move.
  if (plan.items.some((item) => item.status === "COMPLETED")) {
    throw new PlanHasCompletedItemsError();
  }

  const newPlan = await createPlanRow(actorId);
  await assignPlanRow(newPlan.id, targetUserId, date, actorId);
  await movePlanItems(planId, newPlan.id);
  await deletePlanRow(planId);
  return newPlan.id;
}

// "Cancel the assignment" — bulk-cancels every still-PENDING item, same
// authorization boundary as every other action on an assigned plan. Does
// NOT revert the plan to unassigned; completed items (if any) are
// untouched, cancelled items stay cancelled, only PENDING flips.
export async function cancelPlanAssignment(
  planId: string,
  actorId: string,
  actorRoleName: string,
): Promise<void> {
  const plan = await findPlanById(planId);
  if (!plan || plan.userId === null) return;
  await assertCanActOnPlan(plan, actorId, actorRoleName);

  await cancelPendingPlanItems(planId, actorId);
}
