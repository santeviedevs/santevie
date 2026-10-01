"use server";

import { revalidatePath } from "next/cache";

import { createHolidaySchema, updateHolidaySchema } from "@/lib/schemas/holiday";
import { requirePermission, SessionExpiredError } from "@/server/auth/require-permission";
import { createHoliday, updateHoliday } from "@/server/services/holiday-service";

export type HolidayFormState = { error: string | null; sessionExpired?: boolean };

async function requireHolidaysManage() {
  try {
    return await requirePermission("holidays:manage");
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      return null;
    }
    throw error;
  }
}

function readStatus(formData: FormData, field: string) {
  const value = formData.get(field);
  return value === "ACTIVE" || value === "INACTIVE" ? value : undefined;
}

export async function createHolidayAction(
  _prevState: HolidayFormState,
  formData: FormData,
): Promise<HolidayFormState> {
  const session = await requireHolidaysManage();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = createHolidaySchema.safeParse({
    name: formData.get("name"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    territoryId: formData.get("territoryId") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  await createHoliday(parsed.data, session.user.id);

  revalidatePath("/calendar/holidays");
  return { error: null };
}

export async function updateHolidayAction(
  _prevState: HolidayFormState,
  formData: FormData,
): Promise<HolidayFormState> {
  const session = await requireHolidaysManage();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = updateHolidaySchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    territoryId: formData.get("territoryId") || undefined,
    status: readStatus(formData, "status"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  await updateHoliday(parsed.data, session.user.id);

  revalidatePath("/calendar/holidays");
  return { error: null };
}
