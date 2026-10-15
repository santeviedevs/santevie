"use server";

import { revalidatePath } from "next/cache";

import {
  correctEmballageCollectionSchema,
  createEmballageCollectionSchema,
  finalizeEmballageReportSchema,
} from "@/lib/schemas/emballage";
import { hasPermission, type Permission } from "@/server/auth/permissions";
import {
  requireAnyPermission,
  requirePermission,
  SessionExpiredError,
} from "@/server/auth/require-permission";
import {
  correctEmballageCollection,
  createEmballageCollection,
  EmballageCollectionLockedError,
  EmballageCollectionNotFoundError,
  EmballageNotAuthorizedError,
  EmballageReportAlreadyFinalizedError,
  finalizeEmballageReport,
} from "@/server/services/emballage-service";

export type EmballageFormState = { error: string | null; sessionExpired?: boolean };

async function requireEmballagePermission(permission: Permission) {
  try {
    return await requirePermission(permission);
  } catch (error) {
    if (error instanceof SessionExpiredError) return null;
    throw error;
  }
}

async function requireAnyEmballagePermission(permissions: readonly Permission[]) {
  try {
    return await requireAnyPermission(permissions);
  } catch (error) {
    if (error instanceof SessionExpiredError) return null;
    throw error;
  }
}

function mapEmballageError(error: unknown): string {
  if (
    error instanceof EmballageCollectionNotFoundError ||
    error instanceof EmballageNotAuthorizedError ||
    error instanceof EmballageCollectionLockedError ||
    error instanceof EmballageReportAlreadyFinalizedError
  ) {
    return error.message;
  }
  throw error;
}

function revalidateEmballageScreens() {
  revalidatePath("/emballage", "layout");
}

export async function createEmballageCollectionAction(
  _prevState: EmballageFormState,
  formData: FormData,
): Promise<EmballageFormState> {
  const session = await requireEmballagePermission("emballage:record-own");
  if (!session) return { error: null, sessionExpired: true };

  const parsed = createEmballageCollectionSchema.safeParse({
    centerId: formData.get("centerId"),
    productId: formData.get("productId"),
    visitDate: formData.get("visitDate"),
    quantity: formData.get("quantity"),
    remarks: formData.get("remarks") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  await createEmballageCollection(parsed.data, session.user.id);

  revalidateEmballageScreens();
  return { error: null };
}

// Correcting an unlocked row only needs emballage:record-own (the owning
// delegate correcting their own mistake); a locked row (already covered by
// a finalized EOM report) additionally needs emballage:correct-locked —
// the service enforces both, this just resolves the flag from the
// session's permission set.
export async function correctEmballageCollectionAction(
  _prevState: EmballageFormState,
  formData: FormData,
): Promise<EmballageFormState> {
  const session = await requireAnyEmballagePermission([
    "emballage:record-own",
    "emballage:correct-locked",
  ]);
  if (!session) return { error: null, sessionExpired: true };

  const parsed = correctEmballageCollectionSchema.safeParse({
    id: formData.get("id"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await correctEmballageCollection(
      parsed.data,
      session,
      hasPermission(session.user.permissions, "emballage:correct-locked"),
    );
  } catch (error) {
    return { error: mapEmballageError(error) };
  }

  revalidateEmballageScreens();
  return { error: null };
}

export async function finalizeEmballageReportAction(
  _prevState: EmballageFormState,
  formData: FormData,
): Promise<EmballageFormState> {
  const session = await requireEmballagePermission("emballage:finalize-report");
  if (!session) return { error: null, sessionExpired: true };

  const parsed = finalizeEmballageReportSchema.safeParse({
    periodMonth: formData.get("periodMonth"),
    periodYear: formData.get("periodYear"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await finalizeEmballageReport(parsed.data, session.user.id);
  } catch (error) {
    return { error: mapEmballageError(error) };
  }

  revalidateEmballageScreens();
  return { error: null };
}
