"use server";

import { revalidatePath } from "next/cache";

import { createUserSchema, updateUserSchema } from "@/lib/schemas/user";
import { requirePermission, SessionExpiredError } from "@/server/auth/require-permission";
import {
  createUser,
  DuplicateEmailError,
  DuplicateEmployeeCodeError,
  ManagerCycleError,
  SelfManagerError,
  updateUser,
} from "@/server/services/user-service";

export type UserFormState = { error: string | null; sessionExpired?: boolean };

async function requireUsersManage() {
  try {
    return await requirePermission("users:manage");
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      return null;
    }
    throw error;
  }
}

function messageFor(error: unknown): string {
  if (
    error instanceof DuplicateEmployeeCodeError ||
    error instanceof DuplicateEmailError ||
    error instanceof ManagerCycleError ||
    error instanceof SelfManagerError
  ) {
    return error.message;
  }
  throw error;
}

function readId(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readManagerAndTerritory(formData: FormData) {
  return {
    managerId: readId(formData, "managerId"),
    provinceId: readId(formData, "provinceId"),
    villeId: readId(formData, "villeId"),
    communeId: readId(formData, "communeId"),
    quartierId: readId(formData, "quartierId"),
  };
}

export async function createUserAction(
  _prevState: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const session = await requireUsersManage();
  if (!session) {
    return { error: null, sessionExpired: true };
  }

  const parsed = createUserSchema.safeParse({
    employeeCode: formData.get("employeeCode"),
    name: formData.get("name"),
    email: formData.get("email"),
    roleId: formData.get("roleId"),
    ...readManagerAndTerritory(formData),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await createUser(parsed.data, session.user.id);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/admin/users");
  return { error: null };
}

export async function updateUserAction(
  _prevState: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const session = await requireUsersManage();
  if (!session) {
    return { error: null, sessionExpired: true };
  }

  const status = formData.get("status");

  const parsed = updateUserSchema.safeParse({
    id: formData.get("id"),
    employeeCode: formData.get("employeeCode"),
    name: formData.get("name"),
    email: formData.get("email"),
    roleId: formData.get("roleId"),
    status: status === "ACTIVE" || status === "INACTIVE" ? status : undefined,
    ...readManagerAndTerritory(formData),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await updateUser(parsed.data, session.user.id);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/admin/users");
  return { error: null };
}
