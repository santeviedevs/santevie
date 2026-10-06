"use server";

import { revalidatePath } from "next/cache";

import { decideLeaveSchema } from "@/lib/schemas/leave";
import { requirePermission, SessionExpiredError } from "@/server/auth/require-permission";
import {
  decideLeave,
  InvalidLeaveTransitionError,
  LeaveNotFoundError,
  NotAuthorizedApproverError,
} from "@/server/services/leave-service";

export type LeaveDecisionFormState = { error: string | null; sessionExpired?: boolean };

async function requireLeaveApprove() {
  try {
    return await requirePermission("leave:approve");
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      return null;
    }
    throw error;
  }
}

function messageFor(error: unknown): string {
  if (
    error instanceof LeaveNotFoundError ||
    error instanceof InvalidLeaveTransitionError ||
    error instanceof NotAuthorizedApproverError
  ) {
    return error.message;
  }
  throw error;
}

// `leave:approve` above is only the coarse "can this role ever decide a
// request" gate. The row-level check — is this specific requester actually
// within the current user's reporting-hierarchy scope — happens inside
// decideLeave itself, reusing src/server/scope.ts exactly as Team Leaves'
// own visibility does. The UI only renders Approve/Reject when in scope,
// but that's presentation; this server check is the real enforcement.
export async function decideLeaveAction(
  _prevState: LeaveDecisionFormState,
  formData: FormData,
): Promise<LeaveDecisionFormState> {
  const session = await requireLeaveApprove();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = decideLeaveSchema.safeParse({
    leaveId: formData.get("leaveId"),
    decision: formData.get("decision"),
    remark: formData.get("remark") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await decideLeave(parsed.data.leaveId, parsed.data.decision, parsed.data.remark, {
      id: session.user.id,
      roleName: session.user.roleName,
    });
  } catch (error) {
    return { error: messageFor(error) };
  }

  // Also called from My Leaves — Admin's own request never appears on Team
  // Leaves (that list is downstream-only), so this action is Admin's only
  // path to decide their own pending leave.
  revalidatePath("/leaves/team");
  revalidatePath("/leaves/my");
  return { error: null };
}
