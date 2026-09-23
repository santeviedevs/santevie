"use server";

import { revalidatePath } from "next/cache";

import { createClientSchema, updateClientSchema } from "@/lib/schemas/client";
import { requirePermission, SessionExpiredError } from "@/server/auth/require-permission";
import {
  ClientTypeMismatchError,
  createClient,
  DuplicateClientCodeError,
  InactiveTerritoryError,
  updateClient,
} from "@/server/services/client-service";

export type ClientFormState = { error: string | null; sessionExpired?: boolean };

async function requireClientsManage() {
  try {
    return await requirePermission("clients:manage");
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      return null;
    }
    throw error;
  }
}

function messageFor(error: unknown): string {
  if (
    error instanceof DuplicateClientCodeError ||
    error instanceof InactiveTerritoryError ||
    error instanceof ClientTypeMismatchError
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

function readHospitalIds(formData: FormData): string[] {
  return formData.getAll("hospitalIds").filter((v): v is string => typeof v === "string");
}

function readCommon(formData: FormData) {
  const typeCode = readText(formData, "typeCode");
  return {
    code: formData.get("code"),
    name: formData.get("name"),
    typeId: formData.get("typeId"),
    contact: readText(formData, "contact"),
    address: readText(formData, "address"),
    latitude: readNumber(formData, "latitude"),
    longitude: readNumber(formData, "longitude"),
    provinceId: readId(formData, "provinceId"),
    villeId: readId(formData, "villeId"),
    communeId: readId(formData, "communeId"),
    quartierId: readId(formData, "quartierId"),
    doctor:
      typeCode === "DOCTOR"
        ? {
            doctorType: readText(formData, "doctorType"),
            gender: readText(formData, "gender"),
            department: readText(formData, "department"),
            mobileNo: readText(formData, "mobileNo"),
          }
        : undefined,
    hospital:
      typeCode === "HOSPITAL"
        ? { hospitalCategory: readText(formData, "hospitalCategory") }
        : undefined,
    hospitalIds: typeCode === "DOCTOR" ? readHospitalIds(formData) : undefined,
  };
}

export async function createClientAction(
  _prevState: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const session = await requireClientsManage();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = createClientSchema.safeParse(readCommon(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await createClient(parsed.data, session.user.id);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/admin/clients");
  return { error: null };
}

export async function updateClientAction(
  _prevState: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const session = await requireClientsManage();
  if (!session) return { error: null, sessionExpired: true };

  const status = formData.get("status");

  const parsed = updateClientSchema.safeParse({
    id: formData.get("id"),
    ...readCommon(formData),
    status: status === "ACTIVE" || status === "INACTIVE" ? status : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await updateClient(parsed.data, session.user.id);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/admin/clients");
  return { error: null };
}
