"use server";

import { revalidatePath } from "next/cache";

import { createAttendanceRuleSchema } from "@/lib/schemas/attendance-rule";
import { requirePermission, SessionExpiredError } from "@/server/auth/require-permission";
import {
  AttendanceRuleScopeError,
  createAttendanceRule,
} from "@/server/services/attendance-rule-service";

export type AttendanceRuleFormState = { error: string | null; sessionExpired?: boolean };

async function requireAttendanceRulesManage() {
  try {
    return await requirePermission("attendance-rules:manage");
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      return null;
    }
    throw error;
  }
}

export async function createAttendanceRuleAction(
  _prevState: AttendanceRuleFormState,
  formData: FormData,
): Promise<AttendanceRuleFormState> {
  const session = await requireAttendanceRulesManage();
  if (!session) return { error: null, sessionExpired: true };

  const scope = formData.get("scope");
  const base = {
    expectedStartMinutes: Number(formData.get("expectedStartMinutes")),
    lateGraceMinutes: Number(formData.get("lateGraceMinutes")),
    minimumWorkedMinutes: Number(formData.get("minimumWorkedMinutes")),
  };

  const raw =
    scope === "territory"
      ? { ...base, scope, territoryId: formData.get("territoryId") }
      : scope === "team"
        ? { ...base, scope }
        : { ...base, scope, targetUserId: formData.get("targetUserId") };

  const parsed = createAttendanceRuleSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await createAttendanceRule(parsed.data, session.user.id, session.user.roleName);
  } catch (error) {
    if (error instanceof AttendanceRuleScopeError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath("/attendance-rules");
  return { error: null };
}
