"use server";

import { revalidatePath } from "next/cache";

import {
  assignRouteSchema,
  cancelRouteAssignmentSchema,
  cancelRouteItemSchema,
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
  CenterNotFoundError,
  CenterOutsideTerritoryError,
  completeRouteItem,
  DuplicateCenterOnRouteError,
  reorderRouteItems,
  RouteEditCutoffError,
  RouteHasCompletedItemsError,
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
    error instanceof CenterNotFoundError
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
// `centerIdsInOrder` is the editor's whole local draft, in order. Only
// reachable from Plan Routes (new-route and edit-route pages).
export async function saveRouteAction(
  _prevState: RouteFormState,
  formData: FormData,
): Promise<RouteFormState> {
  const session = await requireRoutesAssignTeam();
  if (!session) return { error: null, sessionExpired: true };

  const routeId = formData.get("routeId");
  const parsed = saveRouteContentSchema.safeParse({
    routeId: routeId ? routeId : null,
    centerIdsInOrder: formData.getAll("centerIdsInOrder"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  let savedRouteId: string;
  try {
    savedRouteId = await saveRouteContent(
      parsed.data.routeId ?? null,
      parsed.data.centerIdsInOrder,
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
