"use server";

import { revalidatePath } from "next/cache";

import {
  assignTerritorySchema,
  removeTerritoryAssignmentSchema,
} from "@/lib/schemas/territory-assignment";
import { requirePermission, SessionExpiredError } from "@/server/auth/require-permission";
import {
  AssignmentNotFoundError,
  assignTerritory,
  DuplicateAssignmentError,
  InactiveTerritoryError,
  removeTerritoryAssignment,
  TerritoryNotFoundError,
} from "@/server/services/territory-assignment-service";

export type AssignmentFormState = { error: string | null; sessionExpired?: boolean };

async function requireTerritoriesManage() {
  try {
    return await requirePermission("territories:manage");
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      return null;
    }
    throw error;
  }
}

function messageFor(error: unknown): string {
  if (
    error instanceof TerritoryNotFoundError ||
    error instanceof InactiveTerritoryError ||
    error instanceof DuplicateAssignmentError ||
    error instanceof AssignmentNotFoundError
  ) {
    return error.message;
  }
  throw error;
}

function readId(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function assignTerritoryAction(
  _prevState: AssignmentFormState,
  formData: FormData,
): Promise<AssignmentFormState> {
  const session = await requireTerritoriesManage();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = assignTerritorySchema.safeParse({
    userId: formData.get("userId"),
    provinceId: readId(formData, "provinceId"),
    villeId: readId(formData, "villeId"),
    communeId: readId(formData, "communeId"),
    quartierId: readId(formData, "quartierId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await assignTerritory(parsed.data, session.user.id);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/admin/territories/assignment");
  return { error: null };
}

export async function removeTerritoryAssignmentAction(
  _prevState: AssignmentFormState,
  formData: FormData,
): Promise<AssignmentFormState> {
  const session = await requireTerritoriesManage();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = removeTerritoryAssignmentSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await removeTerritoryAssignment(parsed.data.id);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/admin/territories/assignment");
  return { error: null };
}
