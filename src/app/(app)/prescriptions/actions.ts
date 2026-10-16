"use server";

import { revalidatePath } from "next/cache";

import {
  createPrescriptionTargetSchema,
  recordPrescriptionUpdateSchema,
  updatePrescriptionTargetSchema,
} from "@/lib/schemas/prescription";
import type { Permission } from "@/server/auth/permissions";
import { requirePermission, SessionExpiredError } from "@/server/auth/require-permission";
import {
  createPrescriptionTarget,
  PrescriptionCorrectionReasonRequiredError,
  PrescriptionDecreaseConfirmationRequiredError,
  PrescriptionNotAuthorizedError,
  PrescriptionTargetDuplicateError,
  PrescriptionTargetNotFoundError,
  recordPrescriptionUpdate,
  updatePrescriptionTarget,
} from "@/server/services/prescription-service";

export type PrescriptionTargetFormState = { error: string | null; sessionExpired?: boolean };

// Distinct from PrescriptionTargetFormState: a rejected decrease isn't a
// plain validation error, it's a "confirm or correct" prompt the form has
// to resubmit against. currentAchieved is the server-verified latest value
// (never the one the page happened to load with) so the confirmation
// dialog always shows the real figure.
export type RecordPrescriptionUpdateFormState = {
  error: string | null;
  sessionExpired?: boolean;
  needsDecreaseConfirmation?: boolean;
  currentAchieved?: number | null;
};

async function requirePrescriptionPermission(permission: Permission) {
  try {
    return await requirePermission(permission);
  } catch (error) {
    if (error instanceof SessionExpiredError) return null;
    throw error;
  }
}

function mapPrescriptionTargetError(error: unknown): string {
  if (
    error instanceof PrescriptionTargetNotFoundError ||
    error instanceof PrescriptionTargetDuplicateError
  ) {
    return error.message;
  }
  throw error;
}

function revalidatePrescriptionScreens() {
  revalidatePath("/prescriptions", "layout");
  revalidatePath("/", "page");
}

export async function createPrescriptionTargetAction(
  _prevState: PrescriptionTargetFormState,
  formData: FormData,
): Promise<PrescriptionTargetFormState> {
  const session = await requirePrescriptionPermission("prescriptions:manage-targets");
  if (!session) return { error: null, sessionExpired: true };

  const parsed = createPrescriptionTargetSchema.safeParse({
    contactId: formData.get("contactId"),
    productId: formData.get("productId"),
    userId: formData.get("userId"),
    monthlyTarget: formData.get("monthlyTarget"),
    periodMonth: formData.get("periodMonth"),
    periodYear: formData.get("periodYear"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await createPrescriptionTarget(parsed.data, session);
  } catch (error) {
    return { error: mapPrescriptionTargetError(error) };
  }

  revalidatePrescriptionScreens();
  return { error: null };
}

export async function updatePrescriptionTargetAction(
  _prevState: PrescriptionTargetFormState,
  formData: FormData,
): Promise<PrescriptionTargetFormState> {
  const session = await requirePrescriptionPermission("prescriptions:manage-targets");
  if (!session) return { error: null, sessionExpired: true };

  const parsed = updatePrescriptionTargetSchema.safeParse({
    id: formData.get("id"),
    monthlyTarget: formData.get("monthlyTarget"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await updatePrescriptionTarget(parsed.data, session);
  } catch (error) {
    return { error: mapPrescriptionTargetError(error) };
  }

  revalidatePrescriptionScreens();
  return { error: null };
}

// Two-stage: a plain submission that turns out to be a decrease comes back
// with needsDecreaseConfirmation (and, once confirmed, a missing
// correctionReason comes back the same way) rather than a hard error — the
// form re-renders with the dialog instead of losing the user's input.
export async function recordPrescriptionUpdateAction(
  _prevState: RecordPrescriptionUpdateFormState,
  formData: FormData,
): Promise<RecordPrescriptionUpdateFormState> {
  const session = await requirePrescriptionPermission("prescriptions:update-progress");
  if (!session) return { error: null, sessionExpired: true };

  const parsed = recordPrescriptionUpdateSchema.safeParse({
    targetId: formData.get("targetId"),
    cumulativeAchieved: formData.get("cumulativeAchieved"),
    feedback: formData.get("feedback") || undefined,
    challenges: formData.get("challenges") || undefined,
    followUpDate: formData.get("followUpDate") || undefined,
    confirmDecrease: formData.get("confirmDecrease") === "true",
    correctionReason: formData.get("correctionReason") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await recordPrescriptionUpdate(parsed.data, session.user.id);
  } catch (error) {
    if (error instanceof PrescriptionDecreaseConfirmationRequiredError) {
      return {
        error: null,
        needsDecreaseConfirmation: true,
        currentAchieved: error.currentAchieved,
      };
    }
    if (error instanceof PrescriptionCorrectionReasonRequiredError) {
      return {
        error: error.message,
        needsDecreaseConfirmation: true,
        currentAchieved: error.currentAchieved,
      };
    }
    if (
      error instanceof PrescriptionTargetNotFoundError ||
      error instanceof PrescriptionNotAuthorizedError
    ) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePrescriptionScreens();
  return { error: null };
}
