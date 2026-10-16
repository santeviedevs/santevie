"use server";

import { revalidatePath } from "next/cache";

import {
  assignRouteSchema,
  cancelRouteAssignmentSchema,
  cancelRouteItemContactSchema,
  cancelRouteItemSchema,
  completeRouteItemContactSchema,
  completeRouteItemSchema,
  reassignRouteSchema,
  reorderRouteItemsSchema,
  saveRouteContentSchema,
} from "@/lib/schemas/route";
import { parseDateOnly } from "@/lib/week";
import {
  requireAnyPermission,
  requirePermission,
  SessionExpiredError,
} from "@/server/auth/require-permission";
import {
  AssigneeNotAssignableError,
  AssignmentNotActiveError,
  AssignmentNotFoundError,
  assignRoute,
  cancelRouteAssignment,
  cancelRouteItem,
  cancelRouteItemContact,
  CenterAlreadyOnRouteError,
  CenterNotFoundError,
  CenterOutsideTerritoryError,
  CenterStatusDerivedError,
  completeRouteItem,
  completeRouteItemContact,
  ContactAlreadyOnRouteError,
  ContactStatusConflictError,
  DuplicateCenterOnRouteError,
  InactiveCenterError,
  InvalidCenterContactError,
  InvalidDateRangeError,
  reassignRoute,
  reorderRouteItems,
  RouteAlreadyAssignedToUserError,
  RouteEditCutoffError,
  RouteHasCompletedItemsError,
  RouteHasNothingToAssignError,
  RouteItemHasCompletedContactsError,
  RouteNotAuthorizedError,
  RouteNotOwnedError,
  RouteStartInPastError,
  saveRouteContent,
} from "@/server/services/route-service";

export type RouteFormState = {
  error: string | null;
  sessionExpired?: boolean;
  // Only ever set by saveRouteAction, so the client can navigate straight to
  // a brand-new route's own URL once it's actually been persisted.
  routeId?: string;
};

async function requireRoutesAssignTeam() {
  try {
    return await requirePermission("routes:assign-team");
  } catch (error) {
    if (error instanceof SessionExpiredError) return null;
    throw error;
  }
}

// Reorder and cancel-item are reachable from both Visits
// (visits:respond-own) and Plan Routes (routes:assign-team) — either grant
// is enough; the service layer's own assertCanActOnRoute still decides who
// can act on which specific route.
async function requireRoutesRespondOrAssign() {
  try {
    return await requireAnyPermission(["visits:respond-own", "routes:assign-team"]);
  } catch (error) {
    if (error instanceof SessionExpiredError) return null;
    throw error;
  }
}

async function requireRoutesRespondOwn() {
  try {
    return await requirePermission("visits:respond-own");
  } catch (error) {
    if (error instanceof SessionExpiredError) return null;
    throw error;
  }
}

function mapRouteError(error: unknown): string {
  if (
    error instanceof RouteEditCutoffError ||
    error instanceof CenterOutsideTerritoryError ||
    error instanceof DuplicateCenterOnRouteError ||
    error instanceof RouteNotAuthorizedError ||
    error instanceof RouteNotOwnedError ||
    error instanceof RouteHasCompletedItemsError ||
    error instanceof CenterNotFoundError ||
    error instanceof CenterAlreadyOnRouteError ||
    error instanceof InactiveCenterError ||
    error instanceof InvalidCenterContactError ||
    error instanceof ContactAlreadyOnRouteError ||
    error instanceof CenterStatusDerivedError ||
    error instanceof RouteItemHasCompletedContactsError ||
    error instanceof ContactStatusConflictError ||
    error instanceof AssigneeNotAssignableError ||
    error instanceof RouteAlreadyAssignedToUserError ||
    error instanceof AssignmentNotFoundError ||
    error instanceof AssignmentNotActiveError ||
    error instanceof RouteHasNothingToAssignError ||
    error instanceof InvalidDateRangeError ||
    error instanceof RouteStartInPastError
  ) {
    return error.message;
  }
  throw error;
}

function revalidateAllRouteScreens() {
  revalidatePath("/");
  revalidatePath("/visits");
  revalidatePath("/routes/add");
  revalidatePath("/routes/assign");
}

// The Plan Routes editor's one write — nothing about a route's content is
// persisted until this runs. `routeId` empty means "create a new route";
// `selections` is the editor's whole local draft as JSON — an ordered list
// of {centerId, contactIds} — validated by Zod and re-checked field by
// field in the service. Only reachable from Plan Routes (new-route and
// edit-route pages).
export async function saveRouteAction(
  _prevState: RouteFormState,
  formData: FormData,
): Promise<RouteFormState> {
  const session = await requireRoutesAssignTeam();
  if (!session) return { error: null, sessionExpired: true };

  const routeId = formData.get("routeId");
  let rawSelections: unknown;
  try {
    rawSelections = JSON.parse(String(formData.get("selections") ?? "[]"));
  } catch {
    return { error: "Check the highlighted fields." };
  }
  const parsed = saveRouteContentSchema.safeParse({
    routeId: routeId ? routeId : null,
    selections: rawSelections,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  let savedRouteId: string;
  try {
    savedRouteId = await saveRouteContent(
      parsed.data.routeId ?? null,
      parsed.data.selections,
      session.user.id,
      session.user.roleName,
    );
  } catch (error) {
    return { error: mapRouteError(error) };
  }

  revalidateAllRouteScreens();
  return { error: null, routeId: savedRouteId };
}

export async function reorderRouteItemsAction(
  _prevState: RouteFormState,
  formData: FormData,
): Promise<RouteFormState> {
  const session = await requireRoutesRespondOrAssign();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = reorderRouteItemsSchema.safeParse({
    routeId: formData.get("routeId"),
    orderedRouteItemIds: formData.getAll("orderedRouteItemIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await reorderRouteItems(
      parsed.data.routeId,
      parsed.data.orderedRouteItemIds,
      session.user.id,
      session.user.roleName,
    );
  } catch (error) {
    return { error: mapRouteError(error) };
  }

  revalidateAllRouteScreens();
  return { error: null };
}

export async function completeRouteItemAction(
  _prevState: RouteFormState,
  formData: FormData,
): Promise<RouteFormState> {
  const session = await requireRoutesRespondOwn();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = completeRouteItemSchema.safeParse({
    routeItemId: formData.get("routeItemId"),
    routeAssignmentId: formData.get("routeAssignmentId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await completeRouteItem(
      parsed.data.routeItemId,
      parsed.data.routeAssignmentId,
      session.user.id,
    );
  } catch (error) {
    return { error: mapRouteError(error) };
  }

  revalidateAllRouteScreens();
  return { error: null };
}

export async function cancelRouteItemAction(
  _prevState: RouteFormState,
  formData: FormData,
): Promise<RouteFormState> {
  const session = await requireRoutesRespondOrAssign();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = cancelRouteItemSchema.safeParse({
    routeItemId: formData.get("routeItemId"),
    routeAssignmentId: formData.get("routeAssignmentId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await cancelRouteItem(
      parsed.data.routeItemId,
      parsed.data.routeAssignmentId,
      session.user.id,
      session.user.roleName,
    );
  } catch (error) {
    return { error: mapRouteError(error) };
  }

  revalidateAllRouteScreens();
  return { error: null };
}

// The Assign Routes form's `+ Add`: creates a new concurrent assignment —
// a route with an existing assignee is still offered; assigning it to a
// second person is expected, not refused. Changing an existing assignment
// is the separate reassignRouteAction.
export async function assignRouteAction(
  _prevState: RouteFormState,
  formData: FormData,
): Promise<RouteFormState> {
  const session = await requireRoutesAssignTeam();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = assignRouteSchema.safeParse({
    routeId: formData.get("routeId"),
    targetUserId: formData.get("targetUserId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await assignRoute(
      parsed.data.routeId,
      parsed.data.targetUserId,
      parseDateOnly(parsed.data.startDate),
      parseDateOnly(parsed.data.endDate),
      session.user.id,
      session.user.roleName,
    );
  } catch (error) {
    return { error: mapRouteError(error) };
  }

  revalidateAllRouteScreens();
  return { error: null };
}

// Reassigning an already-assigned route to someone else and/or another range
// — an explicit action from the table row's Manage page, never reachable
// from the add form.
export async function reassignRouteAction(
  _prevState: RouteFormState,
  formData: FormData,
): Promise<RouteFormState> {
  const session = await requireRoutesAssignTeam();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = reassignRouteSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    targetUserId: formData.get("targetUserId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await reassignRoute(
      parsed.data.assignmentId,
      parsed.data.targetUserId,
      parseDateOnly(parsed.data.startDate),
      parseDateOnly(parsed.data.endDate),
      session.user.id,
      session.user.roleName,
    );
  } catch (error) {
    return { error: mapRouteError(error) };
  }

  revalidateAllRouteScreens();
  return { error: null };
}

export async function cancelRouteAssignmentAction(
  _prevState: RouteFormState,
  formData: FormData,
): Promise<RouteFormState> {
  const session = await requireRoutesAssignTeam();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = cancelRouteAssignmentSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await cancelRouteAssignment(parsed.data.assignmentId, session.user.id, session.user.roleName);
  } catch (error) {
    return { error: mapRouteError(error) };
  }

  revalidateAllRouteScreens();
  return { error: null };
}

export async function completeRouteItemContactAction(
  _prevState: RouteFormState,
  formData: FormData,
): Promise<RouteFormState> {
  const session = await requireRoutesRespondOwn();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = completeRouteItemContactSchema.safeParse({
    routeItemContactId: formData.get("routeItemContactId"),
    routeAssignmentId: formData.get("routeAssignmentId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await completeRouteItemContact(
      parsed.data.routeItemContactId,
      parsed.data.routeAssignmentId,
      session.user.id,
    );
  } catch (error) {
    return { error: mapRouteError(error) };
  }

  revalidateAllRouteScreens();
  return { error: null };
}

export async function cancelRouteItemContactAction(
  _prevState: RouteFormState,
  formData: FormData,
): Promise<RouteFormState> {
  const session = await requireRoutesRespondOrAssign();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = cancelRouteItemContactSchema.safeParse({
    routeItemContactId: formData.get("routeItemContactId"),
    routeAssignmentId: formData.get("routeAssignmentId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await cancelRouteItemContact(
      parsed.data.routeItemContactId,
      parsed.data.routeAssignmentId,
      session.user.id,
      session.user.roleName,
    );
  } catch (error) {
    return { error: mapRouteError(error) };
  }

  revalidateAllRouteScreens();
  return { error: null };
}
