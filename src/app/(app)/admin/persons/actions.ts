"use server";

import { revalidatePath } from "next/cache";

import {
  createLookupSchema,
  createPersonSchema,
  setPersonStatusSchema,
  updatePersonSchema,
} from "@/lib/schemas/person";
import { requirePermission, SessionExpiredError } from "@/server/auth/require-permission";
import type { LookupRow } from "@/server/repositories/person-repository";
import {
  createLookupValue,
  createPerson,
  DuplicatePersonCenterError,
  InactivePersonReferenceError,
  InvalidLookupNameError,
  InvalidPersonReferenceError,
  PersonNotFoundError,
  setPersonStatus,
  updatePerson,
} from "@/server/services/person-service";

export type PersonFormState = { error: string | null; sessionExpired?: boolean };
export type LookupActionState = PersonFormState & { lookup?: LookupRow };

async function requirePersonsManage() {
  try {
    return await requirePermission("persons:manage");
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      return null;
    }
    throw error;
  }
}

// Compared by name, not instanceof — same Server Action module-instance
// caveat the other admin actions work around.
const KNOWN_ERRORS = [
  DuplicatePersonCenterError,
  InactivePersonReferenceError,
  InvalidLookupNameError,
  InvalidPersonReferenceError,
  PersonNotFoundError,
];

function messageFor(error: unknown): string {
  if (KNOWN_ERRORS.some((known) => error instanceof known)) {
    return (error as Error).message;
  }
  throw error;
}

function readText(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readCenters(formData: FormData): unknown {
  const raw = readText(formData, "centers");
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readCommon(formData: FormData) {
  return {
    name: formData.get("name"),
    personTypeId: formData.get("personTypeId"),
    gender: readText(formData, "gender"),
    mobile: readText(formData, "mobile"),
    specializationId: formData.get("specializationId"),
    territoryId: formData.get("territoryId"),
    centers: readCenters(formData),
  };
}

export async function createPersonAction(
  _prevState: PersonFormState,
  formData: FormData,
): Promise<PersonFormState> {
  const session = await requirePersonsManage();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = createPersonSchema.safeParse(readCommon(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await createPerson(parsed.data, session.user.id);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/admin/persons");
  return { error: null };
}

export async function updatePersonAction(
  _prevState: PersonFormState,
  formData: FormData,
): Promise<PersonFormState> {
  const session = await requirePersonsManage();
  if (!session) return { error: null, sessionExpired: true };

  const status = formData.get("status");
  const parsed = updatePersonSchema.safeParse({
    id: formData.get("id"),
    ...readCommon(formData),
    status: status === "ACTIVE" || status === "INACTIVE" ? status : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await updatePerson(parsed.data, session.user.id);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/admin/persons");
  revalidatePath(`/admin/persons/${parsed.data.id}`);
  return { error: null };
}

export async function setPersonStatusAction(
  id: string,
  status: "ACTIVE" | "INACTIVE",
): Promise<PersonFormState> {
  const session = await requirePersonsManage();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = setPersonStatusSchema.safeParse({ id, status });
  if (!parsed.success) return { error: "Invalid request." };

  try {
    await setPersonStatus(parsed.data.id, parsed.data.status, session.user.id);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/admin/persons");
  revalidatePath(`/admin/persons/${parsed.data.id}`);
  return { error: null };
}

// Backs the "Select or add new …" comboboxes. Creating a value that already
// exists returns the existing row.
export async function createLookupAction(kind: string, name: string): Promise<LookupActionState> {
  const session = await requirePersonsManage();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = createLookupSchema.safeParse({ kind, name });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid value." };
  }

  try {
    const lookup = await createLookupValue(parsed.data, session.user.id);
    return { error: null, lookup };
  } catch (error) {
    return { error: messageFor(error) };
  }
}
