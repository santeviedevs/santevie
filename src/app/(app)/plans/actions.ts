"use server";

import { revalidatePath } from "next/cache";

import {
  assignPlanSchema,
  cancelPlanAssignmentSchema,
  cancelPlanItemSchema,
  completePlanItemSchema,
  reorderPlanItemsSchema,
  savePlanContentSchema,
} from "@/lib/schemas/plan";
import {
  requireAnyPermission,
  requirePermission,
  SessionExpiredError,
} from "@/server/auth/require-permission";
import {
  assignPlan,
  cancelPlanAssignment,
  cancelPlanItem,
  CenterNotFoundError,
  CenterOutsideTerritoryError,
  completePlanItem,
  DuplicateCenterOnPlanError,
  PlanEditCutoffError,
  PlanHasCompletedItemsError,
  PlanNotAuthorizedError,
  PlanNotOwnedError,
  reorderPlanItems,
  savePlanContent,
} from "@/server/services/plan-service";

export type PlanFormState = {
  error: string | null;
  sessionExpired?: boolean;
  // Only ever set by savePlanAction, so the client can navigate straight to
  // a brand-new plan's own URL once it's actually been persisted.
  planId?: string;
};

async function requirePlansAssignTeam() {
  try {
    return await requirePermission("plans:assign-team");
  } catch (error) {
    if (error instanceof SessionExpiredError) return null;
    throw error;
  }
}

// Reorder and cancel-item are reachable from both My Visits
// (plans:respond-own) and Plan Visits (plans:assign-team) — either grant
// is enough; the service layer's own assertCanActOnPlan still decides who
// can act on which specific plan.
async function requirePlansRespondOrAssign() {
  try {
    return await requireAnyPermission(["plans:respond-own", "plans:assign-team"]);
  } catch (error) {
    if (error instanceof SessionExpiredError) return null;
    throw error;
  }
}

async function requirePlansRespondOwn() {
  try {
    return await requirePermission("plans:respond-own");
  } catch (error) {
    if (error instanceof SessionExpiredError) return null;
    throw error;
  }
}

function mapPlanError(error: unknown): string {
  if (
    error instanceof PlanEditCutoffError ||
    error instanceof CenterOutsideTerritoryError ||
    error instanceof DuplicateCenterOnPlanError ||
    error instanceof PlanNotAuthorizedError ||
    error instanceof PlanNotOwnedError ||
    error instanceof PlanHasCompletedItemsError ||
    error instanceof CenterNotFoundError
  ) {
    return error.message;
  }
  throw error;
}

function revalidateAllPlanScreens() {
  revalidatePath("/plans");
  revalidatePath("/plans/visits");
  revalidatePath("/plans/assign");
}

// The Plan Visits editor's one write — nothing about a plan's content is
// persisted until this runs. `planId` empty means "create a new plan";
// `centerIdsInOrder` is the editor's whole local draft, in order. Only
// reachable from Plan Visits (new-plan and edit-plan pages).
export async function savePlanAction(
  _prevState: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const session = await requirePlansAssignTeam();
  if (!session) return { error: null, sessionExpired: true };

  const planId = formData.get("planId");
  const parsed = savePlanContentSchema.safeParse({
    planId: planId ? planId : null,
    centerIdsInOrder: formData.getAll("centerIdsInOrder"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  let savedPlanId: string;
  try {
    savedPlanId = await savePlanContent(
      parsed.data.planId ?? null,
      parsed.data.centerIdsInOrder,
      session.user.id,
      session.user.roleName,
    );
  } catch (error) {
    return { error: mapPlanError(error) };
  }

  revalidateAllPlanScreens();
  return { error: null, planId: savedPlanId };
}

export async function reorderPlanItemsAction(
  _prevState: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const session = await requirePlansRespondOrAssign();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = reorderPlanItemsSchema.safeParse({
    planId: formData.get("planId"),
    orderedPlanItemIds: formData.getAll("orderedPlanItemIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await reorderPlanItems(
      parsed.data.planId,
      parsed.data.orderedPlanItemIds,
      session.user.id,
      session.user.roleName,
    );
  } catch (error) {
    return { error: mapPlanError(error) };
  }

  revalidateAllPlanScreens();
  return { error: null };
}

export async function completePlanItemAction(
  _prevState: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const session = await requirePlansRespondOwn();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = completePlanItemSchema.safeParse({ planItemId: formData.get("planItemId") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await completePlanItem(parsed.data.planItemId, session.user.id);
  } catch (error) {
    return { error: mapPlanError(error) };
  }

  revalidateAllPlanScreens();
  return { error: null };
}

export async function cancelPlanItemAction(
  _prevState: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const session = await requirePlansRespondOrAssign();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = cancelPlanItemSchema.safeParse({ planItemId: formData.get("planItemId") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await cancelPlanItem(parsed.data.planItemId, session.user.id, session.user.roleName);
  } catch (error) {
    return { error: mapPlanError(error) };
  }

  revalidateAllPlanScreens();
  return { error: null };
}

// Covers both first-time assignment and reassignment — only reachable
// from the Assignment screen.
export async function assignPlanAction(
  _prevState: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const session = await requirePlansAssignTeam();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = assignPlanSchema.safeParse({
    planId: formData.get("planId"),
    targetUserId: formData.get("targetUserId"),
    date: formData.get("date"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await assignPlan(
      parsed.data.planId,
      parsed.data.targetUserId,
      new Date(parsed.data.date),
      session.user.id,
      session.user.roleName,
    );
  } catch (error) {
    return { error: mapPlanError(error) };
  }

  revalidateAllPlanScreens();
  return { error: null };
}

export async function cancelPlanAssignmentAction(
  _prevState: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const session = await requirePlansAssignTeam();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = cancelPlanAssignmentSchema.safeParse({ planId: formData.get("planId") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await cancelPlanAssignment(parsed.data.planId, session.user.id, session.user.roleName);
  } catch (error) {
    return { error: mapPlanError(error) };
  }

  revalidateAllPlanScreens();
  return { error: null };
}
