"use server";

import { revalidatePath } from "next/cache";

import { checkInSchema, checkOutSchema } from "@/lib/schemas/attendance";
import type { Permission } from "@/server/auth/permissions";
import { requirePermission, SessionExpiredError } from "@/server/auth/require-permission";
import {
  AlreadyCheckedInError,
  checkIn,
  checkOut,
  LocationAccuracyTooLowError,
  LocationRequiredError,
  NoCheckInFoundError,
  NotAWorkingDayError,
} from "@/server/services/attendance-service";

export type AttendanceActionState = {
  error: string | null;
  sessionExpired?: boolean;
};

async function requireAttendancePermission(permission: Permission) {
  try {
    return await requirePermission(permission);
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
    error instanceof NoCheckInFoundError ||
    error instanceof LocationRequiredError ||
    error instanceof LocationAccuracyTooLowError
  ) {
    return error.message;
  }
  throw error;
}

function parseLocationFormData(formData: FormData) {
  const lat = formData.get("lat");
  const lng = formData.get("lng");
  const accuracy = formData.get("accuracy");
  const deviceTimestamp = formData.get("deviceTimestamp");

  return {
    lat: typeof lat === "string" && lat.length > 0 ? Number(lat) : undefined,
    lng: typeof lng === "string" && lng.length > 0 ? Number(lng) : undefined,
    accuracy: typeof accuracy === "string" && accuracy.length > 0 ? Number(accuracy) : undefined,
    deviceTimestamp:
      typeof deviceTimestamp === "string" && deviceTimestamp.length > 0
        ? deviceTimestamp
        : undefined,
  };
}

// Check-in and check-out are always recorded for the authenticated session
// user — userId is never read from the form, same reasoning as
// applyLeaveAction (src/app/(app)/leaves/my/actions.ts): a submitted event
// can't be forged for another employee by editing hidden fields.
export async function checkInAction(
  _prevState: AttendanceActionState,
  formData: FormData,
): Promise<AttendanceActionState> {
  const session = await requireAttendancePermission("attendance:check-in");
  if (!session) return { error: null, sessionExpired: true };

  const parsed = checkInSchema.safeParse(parseLocationFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your location and try again." };
  }

  try {
    await checkIn(session.user.id, parsed.data);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/attendance/check-in-out");
  return { error: null };
}

export async function checkOutAction(
  _prevState: AttendanceActionState,
  formData: FormData,
): Promise<AttendanceActionState> {
  const session = await requireAttendancePermission("attendance:check-out");
  if (!session) return { error: null, sessionExpired: true };

  const parsed = checkOutSchema.safeParse(parseLocationFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your location and try again." };
  }

  try {
    await checkOut(session.user.id, parsed.data);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/attendance/check-in-out");
  return { error: null };
}
