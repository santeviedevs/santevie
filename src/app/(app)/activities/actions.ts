"use server";

import { revalidatePath } from "next/cache";

import {
  assignActivitySchema,
  createActivitySchema,
  updateActivityStatusSchema,
} from "@/lib/schemas/activity";
import { completeFollowUpSchema, createFollowUpSchema } from "@/lib/schemas/follow-up";
import { hasPermission, type Permission } from "@/server/auth/permissions";
import { requirePermission, SessionExpiredError } from "@/server/auth/require-permission";
import {
  ActivityNotAuthorizedError,
  ActivityNotFoundError,
  ActivityNotReassignableError,
  assignActivity,
  AssigneeOutsideScopeError,
  createActivity,
  updateActivityStatus,
} from "@/server/services/activity-service";
import {
  ActivityUnassignedError,
  completeFollowUp,
  createFollowUp,
} from "@/server/services/follow-up-service";

export type ActivityFormState = { error: string | null; sessionExpired?: boolean };

async function requireActivityPermission(permission: Permission) {
  try {
    return await requirePermission(permission);
  } catch (error) {
    if (error instanceof SessionExpiredError) return null;
    throw error;
  }
}

// Same shape as mapPlanError in plans/actions.ts: a known business-rule
// error becomes a user-facing message, anything else is a real failure and
// is rethrown.
function mapActivityError(error: unknown): string {
  if (
    error instanceof ActivityNotFoundError ||
    error instanceof ActivityNotAuthorizedError ||
    error instanceof ActivityNotReassignableError ||
    error instanceof AssigneeOutsideScopeError ||
    error instanceof ActivityUnassignedError
  ) {
    return error.message;
  }
  throw error;
}

function revalidateActivityScreens() {
  // "layout" covers every route under /activities (list, assignment,
  // calendar, follow-ups), however the tabs are split across routes.
  revalidatePath("/activities", "layout");
}

// Creating is a manager action: the activity starts unassigned and is given
// to someone on the Assignment step.
export async function createActivityAction(
  _prevState: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const session = await requireActivityPermission("activities:assign");
  if (!session) return { error: null, sessionExpired: true };

  const parsed = createActivitySchema.safeParse({
    type: formData.get("type"),
    date: formData.get("date"),
    centerId: formData.get("centerId") || undefined,
    territoryId: formData.get("territoryId") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  await createActivity(parsed.data, session.user.id);

  revalidateActivityScreens();
  return { error: null };
}

export async function assignActivityAction(
  _prevState: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const session = await requireActivityPermission("activities:assign");
  if (!session) return { error: null, sessionExpired: true };

  const parsed = assignActivitySchema.safeParse({
    id: formData.get("id"),
    ownerId: formData.get("ownerId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await assignActivity(parsed.data, session);
  } catch (error) {
    return { error: mapActivityError(error) };
  }

  revalidateActivityScreens();
  return { error: null };
}

export async function updateActivityStatusAction(
  _prevState: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const session = await requireActivityPermission("activities:respond-own");
  if (!session) return { error: null, sessionExpired: true };

  const parsed = updateActivityStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await updateActivityStatus(
      parsed.data.id,
      parsed.data.status,
      session,
      hasPermission(session.user.permissions, "activities:assign"),
    );
  } catch (error) {
    return { error: mapActivityError(error) };
  }

  revalidateActivityScreens();
  return { error: null };
}

export async function createFollowUpAction(
  _prevState: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const session = await requireActivityPermission("activities:respond-own");
  if (!session) return { error: null, sessionExpired: true };

  const parsed = createFollowUpSchema.safeParse({
    activityId: formData.get("activityId"),
    dueDate: formData.get("dueDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await createFollowUp(
      parsed.data,
      session,
      hasPermission(session.user.permissions, "activities:assign"),
    );
  } catch (error) {
    return { error: mapActivityError(error) };
  }

  revalidateActivityScreens();
  return { error: null };
}

export async function completeFollowUpAction(
  _prevState: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const session = await requireActivityPermission("activities:respond-own");
  if (!session) return { error: null, sessionExpired: true };

  const parsed = completeFollowUpSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await completeFollowUp(parsed.data.id, session.user.id);
  } catch (error) {
    return { error: mapActivityError(error) };
  }

  revalidateActivityScreens();
  return { error: null };
}
