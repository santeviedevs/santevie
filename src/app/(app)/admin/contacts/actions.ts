"use server";

import { revalidatePath } from "next/cache";

import {
  createContactSchema,
  createLookupSchema,
  setContactStatusSchema,
  updateContactSchema,
} from "@/lib/schemas/contact";
import { requirePermission, SessionExpiredError } from "@/server/auth/require-permission";
import type { LookupRow } from "@/server/repositories/contact-repository";
import {
  ContactNotFoundError,
  createContact,
  createLookupValue,
  DuplicateContactCenterError,
  InactiveContactReferenceError,
  InvalidContactReferenceError,
  InvalidLookupNameError,
  setContactStatus,
  updateContact,
} from "@/server/services/contact-service";

export type ContactFormState = { error: string | null; sessionExpired?: boolean };
export type LookupActionState = ContactFormState & { lookup?: LookupRow };

async function requireContactsManage() {
  try {
    return await requirePermission("contacts:manage");
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
  DuplicateContactCenterError,
  InactiveContactReferenceError,
  InvalidLookupNameError,
  InvalidContactReferenceError,
  ContactNotFoundError,
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
    contactTypeId: formData.get("contactTypeId"),
    gender: readText(formData, "gender"),
    mobile: readText(formData, "mobile"),
    specializationId: formData.get("specializationId"),
    territoryId: formData.get("territoryId"),
    centers: readCenters(formData),
  };
}

export async function createContactAction(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const session = await requireContactsManage();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = createContactSchema.safeParse(readCommon(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await createContact(parsed.data, session.user.id);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/admin/contacts");
  return { error: null };
}

export async function updateContactAction(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const session = await requireContactsManage();
  if (!session) return { error: null, sessionExpired: true };

  const status = formData.get("status");
  const parsed = updateContactSchema.safeParse({
    id: formData.get("id"),
    ...readCommon(formData),
    status: status === "ACTIVE" || status === "INACTIVE" ? status : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await updateContact(parsed.data, session.user.id);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/admin/contacts");
  revalidatePath(`/admin/contacts/${parsed.data.id}`);
  return { error: null };
}

export async function setContactStatusAction(
  id: string,
  status: "ACTIVE" | "INACTIVE",
): Promise<ContactFormState> {
  const session = await requireContactsManage();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = setContactStatusSchema.safeParse({ id, status });
  if (!parsed.success) return { error: "Invalid request." };

  try {
    await setContactStatus(parsed.data.id, parsed.data.status, session.user.id);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/admin/contacts");
  revalidatePath(`/admin/contacts/${parsed.data.id}`);
  return { error: null };
}

// Backs the "Select or add new …" comboboxes. Creating a value that already
// exists returns the existing row.
export async function createLookupAction(kind: string, name: string): Promise<LookupActionState> {
  const session = await requireContactsManage();
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
