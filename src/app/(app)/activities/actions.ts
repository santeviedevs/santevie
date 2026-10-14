"use server";

import { revalidatePath } from "next/cache";

import {
  cancelAssignmentSchema,
  createActivitySchema,
  createAssignmentSchema,
  reassignAssignmentSchema,
  updateActivitySchema,
  updateAssignmentExecutionSchema,
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
  updateAssignmentExecution,
  updateAssignmentStatus,
} from "@/server/services/activity-service";
import { completeFollowUp, createFollowUp } from "@/server/services/follow-up-service";

// Products/participants travel as JSON in a hidden field — FormData has no
// native array/nested-object encoding, and this keeps the client-side form
// from needing one field per row.
function parseJsonField<T>(formData: FormData, key: string, fallback: T): T {
  const raw = formData.get(key);
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

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
    typeId: formData.get("typeId"),
    centerId: formData.get("centerId") || undefined,
    territoryId: formData.get("territoryId") || undefined,
    location: formData.get("location") || undefined,
    departmentName: formData.get("departmentName") || undefined,
    speakerContactId: formData.get("speakerContactId") || undefined,
    requirementCategoryId: formData.get("requirementCategoryId") || undefined,
    prescriberCount: formData.get("prescriberCount") || undefined,
    expectedParticipants: formData.get("expectedParticipants") || undefined,
    foodExpense: formData.get("foodExpense") || undefined,
    transportExpense: formData.get("transportExpense") || undefined,
    notes: formData.get("notes") || undefined,
    products: parseJsonField(formData, "productsJson", []),
    participantContactIds: parseJsonField(formData, "participantContactIdsJson", []),
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
    typeId: formData.get("typeId"),
    centerId: formData.get("centerId") || undefined,
    territoryId: formData.get("territoryId") || undefined,
    location: formData.get("location") || undefined,
    departmentName: formData.get("departmentName") || undefined,
    speakerContactId: formData.get("speakerContactId") || undefined,
    requirementCategoryId: formData.get("requirementCategoryId") || undefined,
    prescriberCount: formData.get("prescriberCount") || undefined,
    expectedParticipants: formData.get("expectedParticipants") || undefined,
    foodExpense: formData.get("foodExpense") || undefined,
    transportExpense: formData.get("transportExpense") || undefined,
    notes: formData.get("notes") || undefined,
    products: parseJsonField(formData, "productsJson", []),
    participantContactIds: parseJsonField(formData, "participantContactIdsJson", []),
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
    scheduledDate: formData.get("scheduledDate"),
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

// This delegate's own execution record for an assignment — present
// participants, per-product results and the type-specific fields the form
// shows for that activity's type. Own-assignment-or-canAssign, same reach
// as updateAssignmentStatus; only while the assignment is still PLANNED.
export async function updateAssignmentExecutionAction(
  _prevState: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const session = await requireActivityPermission("activities:respond-own");
  if (!session) return { error: null, sessionExpired: true };

  const parsed = updateAssignmentExecutionSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    outcomeNotes: formData.get("outcomeNotes") || undefined,
    hcpFeedback: formData.get("hcpFeedback") || undefined,
    beneficiaryFeedback: formData.get("beneficiaryFeedback") || undefined,
    commitments: formData.get("commitments") || undefined,
    pregnantWomenReached: formData.get("pregnantWomenReached") || undefined,
    childrenConsulted: formData.get("childrenConsulted") || undefined,
    actualParticipants: formData.get("actualParticipants") || undefined,
    nightShiftTiming: formData.get("nightShiftTiming") || undefined,
    requirementValue: formData.get("requirementValue") || undefined,
    supportProvidedDescription: formData.get("supportProvidedDescription") || undefined,
    recipientContactId: formData.get("recipientContactId") || undefined,
    foodExpense: formData.get("foodExpense") || undefined,
    transportExpense: formData.get("transportExpense") || undefined,
    results: parseJsonField(formData, "resultsJson", []),
    productResults: parseJsonField(formData, "productResultsJson", []),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await updateAssignmentExecution(
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
