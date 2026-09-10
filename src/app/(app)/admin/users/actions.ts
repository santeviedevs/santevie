"use server";

import { revalidatePath } from "next/cache";

import { createUserSchema, updateUserSchema } from "@/lib/schemas/user";
import { requirePermission, SessionExpiredError } from "@/server/auth/require-permission";
import {
  createUser,
  deactivateUser,
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

function readManagerAndTerritory(formData: FormData) {
  const managerId = formData.get("managerId");
  const homeTerritoryId = formData.get("homeTerritoryId");
  return {
    managerId: typeof managerId === "string" && managerId.length > 0 ? managerId : null,
    homeTerritoryId:
      typeof homeTerritoryId === "string" && homeTerritoryId.length > 0 ? homeTerritoryId : null,
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

  const parsed = updateUserSchema.safeParse({
    id: formData.get("id"),
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
    await updateUser(parsed.data, session.user.id);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/admin/users");
  return { error: null };
}

export async function deactivateUserAction(userId: string): Promise<UserFormState> {
  const session = await requireUsersManage();
  if (!session) {
    return { error: null, sessionExpired: true };
  }

  try {
    await deactivateUser(userId, session.user.id);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/admin/users");
  return { error: null };
}
