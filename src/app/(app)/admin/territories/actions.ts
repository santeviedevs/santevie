"use server";

import { revalidatePath } from "next/cache";

import { createTerritorySchema, updateTerritorySchema } from "@/lib/schemas/territory";
import { requirePermission, SessionExpiredError } from "@/server/auth/require-permission";
import {
  createTerritory,
  DuplicateTerritoryNameError,
  DuplicateTerritoryPathError,
  InactiveParentError,
  InvalidTerritoryHierarchyError,
  TerritoryInUseError,
  updateTerritoryEntry,
} from "@/server/services/territory-service";

export type TerritoryFormState = { error: string | null; sessionExpired?: boolean };

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
    error instanceof DuplicateTerritoryNameError ||
    error instanceof DuplicateTerritoryPathError ||
    error instanceof TerritoryInUseError ||
    error instanceof InvalidTerritoryHierarchyError ||
    error instanceof InactiveParentError
  ) {
    return error.message;
  }
  throw error;
}

// Each level arrives as two fields: "<prefix>Mode" ("existing" or "new")
// plus either "<prefix>Id" or "<prefix>Name" depending on the mode —
// matching what TerritoryForm's combo fields hold client-side. A level
// left untouched (blank "existing" pick, or a blank typed name) reads as
// undefined — the level wasn't provided at all.
function readAncestorLevel(formData: FormData, prefix: string) {
  const mode = formData.get(`${prefix}Mode`);
  if (mode === "new") {
    const name = formData.get(`${prefix}Name`);
    if (typeof name !== "string" || name.trim() === "") return undefined;
    return { mode: "new" as const, name };
  }
  const id = formData.get(`${prefix}Id`);
  if (typeof id !== "string" || id === "") return undefined;
  return { mode: "existing" as const, id };
}

function readStatus(formData: FormData, field: string) {
  const value = formData.get(field);
  return value === "ACTIVE" || value === "INACTIVE" ? value : undefined;
}

export async function createTerritoryAction(
  _prevState: TerritoryFormState,
  formData: FormData,
): Promise<TerritoryFormState> {
  const session = await requireTerritoriesManage();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = createTerritorySchema.safeParse({
    province: readAncestorLevel(formData, "province"),
    ville: readAncestorLevel(formData, "ville"),
    commune: readAncestorLevel(formData, "commune"),
    quartier: readAncestorLevel(formData, "quartier"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await createTerritory(parsed.data, session.user.id);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/admin/territories");
  return { error: null };
}

export async function updateTerritoryAction(
  _prevState: TerritoryFormState,
  formData: FormData,
): Promise<TerritoryFormState> {
  const session = await requireTerritoriesManage();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = updateTerritorySchema.safeParse({
    id: formData.get("id"),
    province: readAncestorLevel(formData, "province"),
    ville: readAncestorLevel(formData, "ville"),
    commune: readAncestorLevel(formData, "commune"),
    quartier: readAncestorLevel(formData, "quartier"),
    status: readStatus(formData, "status"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await updateTerritoryEntry(parsed.data, session.user.id);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/admin/territories");
  return { error: null };
}
