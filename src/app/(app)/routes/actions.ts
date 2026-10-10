"use server";

import { revalidatePath } from "next/cache";

import {
  assignRouteSchema,
  cancelRouteAssignmentSchema,
  cancelRouteItemContactSchema,
  cancelRouteItemSchema,
  completeRouteItemContactSchema,
  completeRouteItemSchema,
  reorderRouteItemsSchema,
  saveRouteContentSchema,
} from "@/lib/schemas/route";
import {
  requireAnyPermission,
  requirePermission,
  SessionExpiredError,
} from "@/server/auth/require-permission";
import {
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
  reorderRouteItems,
  RouteEditCutoffError,
  RouteHasCompletedItemsError,
  RouteItemHasCompletedContactsError,
  RouteNotAuthorizedError,
  RouteNotOwnedError,
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
    error instanceof ContactStatusConflictError
  ) {
    return error.message;
  }
  throw error;
}

function revalidateAllRouteScreens() {
  revalidatePath("/visits");
  revalidatePath("/routes/plan");
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

  const parsed = completeRouteItemSchema.safeParse({ routeItemId: formData.get("routeItemId") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await completeRouteItem(parsed.data.routeItemId, session.user.id);
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

  const parsed = cancelRouteItemSchema.safeParse({ routeItemId: formData.get("routeItemId") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await cancelRouteItem(parsed.data.routeItemId, session.user.id, session.user.roleName);
  } catch (error) {
    return { error: mapRouteError(error) };
  }

  revalidateAllRouteScreens();
  return { error: null };
}

// Covers both first-time assignment and reassignment — only reachable
// from the Assignment screen.
export async function assignRouteAction(
  _prevState: RouteFormState,
  formData: FormData,
): Promise<RouteFormState> {
  const session = await requireRoutesAssignTeam();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = assignRouteSchema.safeParse({
    routeId: formData.get("routeId"),
    targetUserId: formData.get("targetUserId"),
    date: formData.get("date"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await assignRoute(
      parsed.data.routeId,
      parsed.data.targetUserId,
      new Date(parsed.data.date),
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

  const parsed = cancelRouteAssignmentSchema.safeParse({ routeId: formData.get("routeId") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await cancelRouteAssignment(parsed.data.routeId, session.user.id, session.user.roleName);
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
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await completeRouteItemContact(parsed.data.routeItemContactId, session.user.id);
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
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await cancelRouteItemContact(
      parsed.data.routeItemContactId,
      session.user.id,
      session.user.roleName,
    );
  } catch (error) {
    return { error: mapRouteError(error) };
  }

  revalidateAllRouteScreens();
  return { error: null };
}
