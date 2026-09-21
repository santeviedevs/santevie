"use server";

import { revalidatePath } from "next/cache";

import { createTerritorySchema, updateTerritorySchema } from "@/lib/schemas/territory";
import { requirePermission, SessionExpiredError } from "@/server/auth/require-permission";
import {
  createTerritory,
  DuplicateTerritoryNameError,
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
    error instanceof TerritoryInUseError ||
    error instanceof InvalidTerritoryHierarchyError ||
    error instanceof InactiveParentError
  ) {
    return error.message;
  }
  throw error;
}

// Each ancestor level arrives as two fields: "<prefix>Mode" ("existing" or
// "new") plus either "<prefix>Id" or "<prefix>Name" depending on the mode —
// matching what TerritoryForm's combo fields hold client-side. Also used
// for the "add a new X below this row" fields on edit ("newVille",
// "newCommune"), same wire shape. A level left untouched (blank "existing"
// pick, or a blank typed name) reads as undefined — the level wasn't
// provided at all, which is valid once a level is optional (Territory can
// now stop at any point in the chain, and editing can grow a new one below
// it).
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
    quartierName: formData.get("quartierName") || undefined,
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
    level: formData.get("level"),
    province: readAncestorLevel(formData, "province"),
    ville: readAncestorLevel(formData, "ville"),
    commune: readAncestorLevel(formData, "commune"),
    name: formData.get("name"),
    status: readStatus(formData, "status"),
    provinceStatus: readStatus(formData, "provinceStatus"),
    villeStatus: readStatus(formData, "villeStatus"),
    communeStatus: readStatus(formData, "communeStatus"),
    newVille: readAncestorLevel(formData, "newVille"),
    newCommune: readAncestorLevel(formData, "newCommune"),
    newQuartierName: formData.get("newQuartierName") || undefined,
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
