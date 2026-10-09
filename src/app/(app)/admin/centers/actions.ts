"use server";

import { revalidatePath } from "next/cache";

import { createCenterSchema, updateCenterSchema } from "@/lib/schemas/center";
import { requirePermission, SessionExpiredError } from "@/server/auth/require-permission";
import {
  CenterTypeMismatchError,
  createCenter,
  DuplicateCenterCodeError,
  InactiveTerritoryError,
  updateCenter,
} from "@/server/services/center-service";

export type CenterFormState = { error: string | null; sessionExpired?: boolean };

async function requireCentersManage() {
  try {
    return await requirePermission("centers:manage");
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      return null;
    }
    throw error;
  }
}

function messageFor(error: unknown): string {
  if (
    error instanceof DuplicateCenterCodeError ||
    error instanceof InactiveTerritoryError ||
    error instanceof CenterTypeMismatchError
  ) {
    return error.message;
  }
  throw error;
}

function readId(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readText(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(formData: FormData, key: string): number | null {
  const value = formData.get(key);
  if (typeof value !== "string" || value.length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readCommon(formData: FormData) {
  const typeCode = readText(formData, "typeCode");
  return {
    code: formData.get("code"),
    name: formData.get("name"),
    typeId: formData.get("typeId"),
    responsiblePerson: readText(formData, "responsiblePerson"),
    contact: readText(formData, "contact"),
    address: readText(formData, "address"),
    latitude: readNumber(formData, "latitude"),
    longitude: readNumber(formData, "longitude"),
    territoryId: readId(formData, "territoryId"),
    hospital:
      typeCode === "HOSPITAL"
        ? { hospitalCategory: readText(formData, "hospitalCategory") }
        : undefined,
  };
}

export async function createCenterAction(
  _prevState: CenterFormState,
  formData: FormData,
): Promise<CenterFormState> {
  const session = await requireCentersManage();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = createCenterSchema.safeParse(readCommon(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await createCenter(parsed.data, session.user.id);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/admin/centers");
  return { error: null };
}

export async function updateCenterAction(
  _prevState: CenterFormState,
  formData: FormData,
): Promise<CenterFormState> {
  const session = await requireCentersManage();
  if (!session) return { error: null, sessionExpired: true };

  const status = formData.get("status");

  const parsed = updateCenterSchema.safeParse({
    id: formData.get("id"),
    ...readCommon(formData),
    status: status === "ACTIVE" || status === "INACTIVE" ? status : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await updateCenter(parsed.data, session.user.id);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/admin/centers");
  return { error: null };
}
