"use server";

import { revalidatePath } from "next/cache";

import { checkInSchema } from "@/lib/schemas/attendance";
import { requirePermission, SessionExpiredError } from "@/server/auth/require-permission";
import {
  AlreadyCheckedInError,
  checkIn,
  type CheckInSummary,
  LocationAccuracyTooLowError,
  LocationRequiredError,
  NotAWorkingDayError,
} from "@/server/services/attendance-service";

export type CheckInFormState = {
  error: string | null;
  sessionExpired?: boolean;
  result?: CheckInSummary;
};

async function requireAttendanceCheckIn() {
  try {
    return await requirePermission("attendance:check-in");
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      return null;
    }
    throw error;
  }
}

function messageFor(error: unknown): string {
  if (
    error instanceof AlreadyCheckedInError ||
    error instanceof NotAWorkingDayError ||
    error instanceof LocationRequiredError ||
    error instanceof LocationAccuracyTooLowError
  ) {
    return error.message;
  }
  throw error;
}

// Check-in is always recorded for the authenticated session user — userId is
// never read from the form, same reasoning as applyLeaveAction (src/app/
// (app)/leaves/my/actions.ts): a submitted check-in can't be forged for
// another employee by editing hidden fields.
export async function checkInAction(
  _prevState: CheckInFormState,
  formData: FormData,
): Promise<CheckInFormState> {
  const session = await requireAttendanceCheckIn();
  if (!session) return { error: null, sessionExpired: true };

  const lat = formData.get("lat");
  const lng = formData.get("lng");
  const accuracy = formData.get("accuracy");
  const deviceTimestamp = formData.get("deviceTimestamp");

  const parsed = checkInSchema.safeParse({
    lat: typeof lat === "string" && lat.length > 0 ? Number(lat) : undefined,
    lng: typeof lng === "string" && lng.length > 0 ? Number(lng) : undefined,
    accuracy: typeof accuracy === "string" && accuracy.length > 0 ? Number(accuracy) : undefined,
    deviceTimestamp:
      typeof deviceTimestamp === "string" && deviceTimestamp.length > 0
        ? deviceTimestamp
        : undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your location and try again." };
  }

  let result: CheckInSummary;
  try {
    result = await checkIn(session.user.id, parsed.data);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/attendance/check-in");
  return { error: null, result };
}
