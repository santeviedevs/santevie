"use server";

import { revalidatePath } from "next/cache";

import { updateWorkingDaysSchema } from "@/lib/schemas/working-day";
import { requirePermission, SessionExpiredError } from "@/server/auth/require-permission";
import { updateWorkingDays } from "@/server/services/working-day-service";

export type WorkingDaysFormState = { error: string | null; sessionExpired?: boolean };

async function requireWorkingDaysManage() {
  try {
    return await requirePermission("working-days:manage");
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      return null;
    }
    throw error;
  }
}

export async function updateWorkingDaysAction(
  _prevState: WorkingDaysFormState,
  formData: FormData,
): Promise<WorkingDaysFormState> {
  const session = await requireWorkingDaysManage();
  if (!session) return { error: null, sessionExpired: true };

  const territoryId = formData.get("territoryId");
  const days = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isWorking: formData.get(`day-${dayOfWeek}`) === "on",
  }));

  const parsed = updateWorkingDaysSchema.safeParse({ territoryId, days });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  await updateWorkingDays(parsed.data, session.user.id);

  revalidatePath(`/admin/territories/${parsed.data.territoryId}/working-days`);
  return { error: null };
}
