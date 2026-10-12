"use server";

import { revalidatePath } from "next/cache";

import {
  cancelAssignmentSchema,
  createActivitySchema,
  createAssignmentSchema,
  reassignAssignmentSchema,
  updateActivitySchema,
  updateAssignmentStatusSchema,
} from "@/lib/schemas/activity";
import { completeFollowUpSchema, createFollowUpSchema } from "@/lib/schemas/follow-up";
import { hasPermission, type Permission } from "@/server/auth/permissions";
import { requirePermission, SessionExpiredError } from "@/server/auth/require-permission";
import {
  ActivityNotAuthorizedError,
  ActivityNotFoundError,
  AssigneeOutsideScopeError,
  AssignmentNotActionableError,
  AssignmentNotFoundError,
  cancelAssignment,
  createActivity,
  createAssignment,
  DuplicateAssignmentError,
  reassignAssignment,
  updateActivity,
  updateAssignmentStatus,
} from "@/server/services/activity-service";
import { completeFollowUp, createFollowUp } from "@/server/services/follow-up-service";

export type ActivityFormState = { error: string | null; sessionExpired?: boolean };

async function requireActivityPermission(permission: Permission) {
  try {
    return await requirePermission(permission);
  } catch (error) {
    if (error instanceof SessionExpiredError) return null;
    throw error;
  }
}

// A known business-rule error becomes a user-facing message; anything else
// is a real failure and is rethrown.
function mapActivityError(error: unknown): string {
  if (
    error instanceof ActivityNotFoundError ||
    error instanceof ActivityNotAuthorizedError ||
    error instanceof AssigneeOutsideScopeError ||
    error instanceof AssignmentNotFoundError ||
    error instanceof AssignmentNotActionableError ||
    error instanceof DuplicateAssignmentError
  ) {
    return error.message;
  }
  throw error;
}

function revalidateActivityScreens() {
  // "layout" covers every route under /activities (list, assignment,
  // calendar, follow-ups, detail pages), however the tabs are split across
  // routes.
  revalidatePath("/activities", "layout");
}

// Creating is a manager action: the activity starts unassigned — the
// Assignment screen is where it's given to one or more people.
export async function createActivityAction(
  _prevState: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const session = await requireActivityPermission("activities:assign");
  if (!session) return { error: null, sessionExpired: true };

  const parsed = createActivitySchema.safeParse({
    name: formData.get("name"),
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

export async function updateActivityAction(
  _prevState: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const session = await requireActivityPermission("activities:assign");
  if (!session) return { error: null, sessionExpired: true };

  const parsed = updateActivitySchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    type: formData.get("type"),
    date: formData.get("date"),
    centerId: formData.get("centerId") || undefined,
    territoryId: formData.get("territoryId") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await updateActivity(parsed.data, session, true);
  } catch (error) {
    return { error: mapActivityError(error) };
  }

  revalidateActivityScreens();
  return { error: null };
}

export async function createAssignmentAction(
  _prevState: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const session = await requireActivityPermission("activities:assign");
  if (!session) return { error: null, sessionExpired: true };

  const parsed = createAssignmentSchema.safeParse({
    activityId: formData.get("activityId"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await createAssignment(parsed.data, session);
  } catch (error) {
    return { error: mapActivityError(error) };
  }

  revalidateActivityScreens();
  return { error: null };
}

export async function reassignAssignmentAction(
  _prevState: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const session = await requireActivityPermission("activities:assign");
  if (!session) return { error: null, sessionExpired: true };

  const parsed = reassignAssignmentSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await reassignAssignment(parsed.data, session);
  } catch (error) {
    return { error: mapActivityError(error) };
  }

  revalidateActivityScreens();
  return { error: null };
}

export async function cancelAssignmentAction(
  _prevState: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const session = await requireActivityPermission("activities:assign");
  if (!session) return { error: null, sessionExpired: true };

  const parsed = cancelAssignmentSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await cancelAssignment(parsed.data.assignmentId, session);
  } catch (error) {
    return { error: mapActivityError(error) };
  }

  revalidateActivityScreens();
  return { error: null };
}

export async function updateAssignmentStatusAction(
  _prevState: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const session = await requireActivityPermission("activities:respond-own");
  if (!session) return { error: null, sessionExpired: true };

  const parsed = updateAssignmentStatusSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await updateAssignmentStatus(
      parsed.data.assignmentId,
      parsed.data.status as "DONE" | "CANCELLED",
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
    assignmentId: formData.get("assignmentId"),
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
