import { type CheckInInput, MAX_ACCEPTABLE_ACCURACY_METERS } from "@/lib/schemas/attendance";
import {
  type AttendanceRow,
  createCheckIn,
  findAttendanceForDate,
} from "@/server/repositories/attendance-repository";
import { findUserById } from "@/server/repositories/user-repository";
import { isWorkingDay } from "@/server/services/working-day-service";

export class UserNotFoundError extends Error {
  constructor() {
    super("User not found.");
    this.name = "UserNotFoundError";
  }
}

export class NotAWorkingDayError extends Error {
  constructor() {
    super("Today isn't a working day, so check-in isn't available.");
    this.name = "NotAWorkingDayError";
  }
}

export class AlreadyCheckedInError extends Error {
  constructor() {
    super("You've already checked in today.");
    this.name = "AlreadyCheckedInError";
  }
}

export class LocationRequiredError extends Error {
  constructor() {
    super("Your check-in requires a GPS location.");
    this.name = "LocationRequiredError";
  }
}

export class LocationAccuracyTooLowError extends Error {
  constructor() {
    super("That location fix isn't precise enough. Move to an open area and try again.");
    this.name = "LocationAccuracyTooLowError";
  }
}

// null = inherit Role.requiresLocation; true/false explicitly overrides it
// for this one user, in either direction.
function resolveRequiresLocation(user: {
  requiresLocation: boolean | null;
  role: { requiresLocation: boolean };
}): boolean {
  return user.requiresLocation ?? user.role.requiresLocation;
}

// Exposed separately from checkIn() so the check-in screen can decide,
// server-side, whether to render the geolocation UI at all before the user
// has submitted anything.
export async function getEffectiveRequiresLocation(userId: string): Promise<boolean> {
  const user = await findUserById(userId);
  if (!user) throw new UserNotFoundError();
  return resolveRequiresLocation(user);
}

// Normalizes to midnight UTC — the Attendance.date column and its
// @@unique([userId, date]) constraint are keyed on the calendar day, not a
// timestamp, and this must match how every other query against that column
// derives "today".
function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export type CheckInSummary = {
  id: string;
  userId: string;
  date: Date;
  checkInAt: Date;
  checkInLat: number | null;
  checkInLng: number | null;
  checkInAccuracy: number | null;
};

function toSummary(row: AttendanceRow): CheckInSummary {
  return {
    id: row.id,
    userId: row.userId,
    date: row.date,
    // checkInAt is always set immediately after createCheckIn below, so this
    // narrows the nullable column to the non-null value this function always
    // actually returns.
    checkInAt: row.checkInAt as Date,
    checkInLat: row.checkInLat === null ? null : Number(row.checkInLat),
    checkInLng: row.checkInLng === null ? null : Number(row.checkInLng),
    checkInAccuracy: row.checkInAccuracy === null ? null : Number(row.checkInAccuracy),
  };
}

export async function checkIn(userId: string, input: CheckInInput): Promise<CheckInSummary> {
  const user = await findUserById(userId);
  if (!user) throw new UserNotFoundError();

  const now = new Date();
  const today = startOfUtcDay(now);

  // A null territoryId fails open (treated as working) — the same choice
  // working-day-service.isWorkingDay and calendar-service already make for
  // a user with no assigned territory.
  const workingToday = user.territoryId
    ? await isWorkingDay(today, user.territoryId, user.id)
    : true;
  if (!workingToday) throw new NotAWorkingDayError();

  const existing = await findAttendanceForDate(user.id, today);
  if (existing?.checkInAt) throw new AlreadyCheckedInError();

  const requiresLocation = resolveRequiresLocation(user);
  const hasLocation = input.lat !== undefined;

  if (requiresLocation && !hasLocation) {
    throw new LocationRequiredError();
  }
  if (hasLocation && input.accuracy! > MAX_ACCEPTABLE_ACCURACY_METERS) {
    throw new LocationAccuracyTooLowError();
  }

  const created = await createCheckIn({
    user: { connect: { id: user.id } },
    date: today,
    checkInAt: now,
    checkInLat: hasLocation ? input.lat : undefined,
    checkInLng: hasLocation ? input.lng : undefined,
    checkInAccuracy: hasLocation ? input.accuracy : undefined,
    checkInDeviceAt:
      hasLocation && input.deviceTimestamp ? new Date(input.deviceTimestamp) : undefined,
    createdBy: user.id,
    updatedBy: user.id,
  });

  return toSummary(created);
}
