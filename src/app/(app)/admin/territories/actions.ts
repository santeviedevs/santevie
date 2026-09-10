"use server";

import { revalidatePath } from "next/cache";

import { createTerritorySchema, updateTerritorySchema } from "@/lib/schemas/territory";
import { requirePermission, SessionExpiredError } from "@/server/auth/require-permission";
import {
  activateTerritory,
  createTerritory,
  deactivateTerritory,
  DuplicateTerritoryCodeError,
  TerritoryInUseError,
  updateTerritory,
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
  if (error instanceof DuplicateTerritoryCodeError || error instanceof TerritoryInUseError) {
    return error.message;
  }
  throw error;
}

export async function createTerritoryAction(
  _prevState: TerritoryFormState,
  formData: FormData,
): Promise<TerritoryFormState> {
  const session = await requireTerritoriesManage();
  if (!session) {
    return { error: null, sessionExpired: true };
  }

  const parsed = createTerritorySchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
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
  if (!session) {
    return { error: null, sessionExpired: true };
  }

  const parsed = updateTerritorySchema.safeParse({
    id: formData.get("id"),
    code: formData.get("code"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await updateTerritory(parsed.data, session.user.id);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/admin/territories");
  return { error: null };
}

export async function activateTerritoryAction(territoryId: string): Promise<TerritoryFormState> {
  const session = await requireTerritoriesManage();
  if (!session) {
    return { error: null, sessionExpired: true };
  }

  try {
    await activateTerritory(territoryId, session.user.id);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/admin/territories");
  return { error: null };
}

export async function deactivateTerritoryAction(
  territoryId: string,
): Promise<TerritoryFormState> {
  const session = await requireTerritoriesManage();
  if (!session) {
    return { error: null, sessionExpired: true };
  }

  try {
    await deactivateTerritory(territoryId, session.user.id);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/admin/territories");
  return { error: null };
}
