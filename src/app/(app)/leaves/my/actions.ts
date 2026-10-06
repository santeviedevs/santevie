"use server";

import { revalidatePath } from "next/cache";

import { applyLeaveSchema } from "@/lib/schemas/leave";
import { requirePermission, SessionExpiredError } from "@/server/auth/require-permission";
import {
  applyLeave,
  InactiveRequesterError,
  OverlappingLeaveError,
} from "@/server/services/leave-service";

export type LeaveFormState = { error: string | null; sessionExpired?: boolean };

async function requireLeaveApply() {
  try {
    return await requirePermission("leave:apply");
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      return null;
    }
    throw error;
  }
}

function messageFor(error: unknown): string {
  if (error instanceof InactiveRequesterError || error instanceof OverlappingLeaveError) {
    return error.message;
  }
  throw error;
}

// Leave is always applied for the authenticated session user — userId is
// never read from the form, so a submitted request can't be forged for
// another employee by editing hidden fields.
export async function applyLeaveAction(
  _prevState: LeaveFormState,
  formData: FormData,
): Promise<LeaveFormState> {
  const session = await requireLeaveApply();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = applyLeaveSchema.safeParse({
    leaveTypeId: formData.get("leaveTypeId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    reason: formData.get("reason") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await applyLeave(parsed.data, session.user.id);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/leaves/my");
  return { error: null };
}
