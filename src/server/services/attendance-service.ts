import { DEFAULT_PAGE_SIZE, type PagedResult, toSkipTake } from "@/lib/pagination";
import {
  type CheckInInput,
  type CheckOutInput,
  MAX_REJECTABLE_ACCURACY_METERS,
} from "@/lib/schemas/attendance";
import {
  type AttendanceSessionRow,
  createSession,
  findAttendanceWithSessions,
  findSessionsForUser,
  updateSession,
  upsertAttendanceDay,
} from "@/server/repositories/attendance-repository";
import { findUserById } from "@/server/repositories/user-repository";
import { deriveAndPersistAttendanceStatus } from "@/server/services/attendance-status-service";
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
    super("You're already checked in — check out before starting a new session.");
    this.name = "AlreadyCheckedInError";
  }
}

export class NoCheckInFoundError extends Error {
  constructor() {
    super("There's no active check-in to check out from.");
    this.name = "NoCheckInFoundError";
  }
}

export class LocationRequiredError extends Error {
  constructor() {
    super("This requires a GPS location.");
    this.name = "LocationRequiredError";
  }
}

export class LocationAccuracyTooLowError extends Error {
  constructor() {
    super("That location fix isn't precise enough. Move to an open area and try again.");
    this.name = "LocationAccuracyTooLowError";
  }
}

// Event-driven status derivation: fired right after a check-in or
// check-out actually writes, so LATE/INCOMPLETE/NEEDS_REVIEW/PRESENT stay
// live on the Attendance row the moment something changes, rather than
// waiting for a report screen to be opened or a nightly job to run. Never
// allowed to fail the check-in/check-out itself — a bug in rule resolution
// is a secondary-feature problem, not a reason to block someone from
// recording their attendance. ABSENT/NON_WORKING are deliberately not
// handled here — there's no check-in/check-out event for a day nobody
// showed up to, so those stay a separate, still-undecided design question.
async function deriveStatusSafely(userId: string, date: Date, actorId: string): Promise<void> {
  try {
    await deriveAndPersistAttendanceStatus(userId, date, actorId);
  } catch (error) {
    console.error("Attendance status derivation failed after a check-in/check-out event", error);
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

// Exposed separately from checkIn()/checkOut() so the screen can decide,
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

export type AttendanceSessionSummary = {
  id: string;
  checkInAt: Date;
  checkInLat: number | null;
  checkInLng: number | null;
  checkInAccuracy: number | null;
  checkOutAt: Date | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  checkOutAccuracy: number | null;
  // null while the session is still open (checkOutAt not set yet) — see the
  // schema decision: a closed session's duration is derived from its own
  // two timestamps here rather than stored, so it can never drift from
  // them. The one open session's "time so far" is a client-side live
  // ticker against checkInAt, not something this value ever represents.
  durationMinutes: number | null;
};

function toSessionSummary(row: AttendanceSessionRow): AttendanceSessionSummary {
  return {
    id: row.id,
    checkInAt: row.checkInAt,
    checkInLat: row.checkInLat === null ? null : Number(row.checkInLat),
    checkInLng: row.checkInLng === null ? null : Number(row.checkInLng),
    checkInAccuracy: row.checkInAccuracy === null ? null : Number(row.checkInAccuracy),
    checkOutAt: row.checkOutAt,
    checkOutLat: row.checkOutLat === null ? null : Number(row.checkOutLat),
    checkOutLng: row.checkOutLng === null ? null : Number(row.checkOutLng),
    checkOutAccuracy: row.checkOutAccuracy === null ? null : Number(row.checkOutAccuracy),
    durationMinutes: row.checkOutAt
      ? Math.round((row.checkOutAt.getTime() - row.checkInAt.getTime()) / 60000)
      : null,
  };
}

// Drives the Check-In/Out card's two states (plus the always-available
// session list for the history table below it), resolved server-side so a
// page reload always lands on the correct state rather than relying on
// client-held transition state.
export type TodayAttendanceState = {
  status: "not-checked-in" | "checked-in";
  latestSession: AttendanceSessionSummary | null;
  sessions: AttendanceSessionSummary[];
};

export async function getTodayAttendanceState(userId: string): Promise<TodayAttendanceState> {
  const today = startOfUtcDay(new Date());
  const attendance = await findAttendanceWithSessions(userId, today);
  const sessions = (attendance?.sessions ?? []).map(toSessionSummary);

  return {
    status: sessions.some((session) => session.checkOutAt === null)
      ? "checked-in"
      : "not-checked-in",
    latestSession: sessions[0] ?? null,
    sessions,
  };
}

// The delegate's own session history across all days, newest first —
// paginated the same way every other list screen is (S2-06). Deliberately
// scoped to one user: cross-team filtering/export belongs to S3-05's
// attendance administration screen, not this personal action screen.
export async function listMySessions(
  userId: string,
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<PagedResult<AttendanceSessionSummary>> {
  const { skip, take } = toSkipTake({ page, pageSize });
  const { items, total } = await findSessionsForUser(userId, skip, take);
  return { items: items.map(toSessionSummary), total, page, pageSize };
}

export async function checkIn(
  userId: string,
  input: CheckInInput,
): Promise<AttendanceSessionSummary> {
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

  const existing = await findAttendanceWithSessions(user.id, today);
  const openSession = existing?.sessions.find((session) => session.checkOutAt === null);
  if (openSession) throw new AlreadyCheckedInError();

  const requiresLocation = resolveRequiresLocation(user);
  const hasLocation = input.lat !== undefined;

  if (requiresLocation && !hasLocation) {
    throw new LocationRequiredError();
  }
  // Only rejects above the higher ceiling now — a fix between the two
  // thresholds is accepted and stored, with NEEDS_REVIEW (derived in
  // attendance-status-service.ts) flagging it for a supervisor afterward
  // rather than blocking the delegate outright.
  if (hasLocation && input.accuracy! > MAX_REJECTABLE_ACCURACY_METERS) {
    throw new LocationAccuracyTooLowError();
  }

  // Reuses the day row across multiple sessions — only actually inserts on
  // this user's first check-in of the day, see upsertAttendanceDay.
  const attendance = existing ?? (await upsertAttendanceDay(user.id, today, user.id));

  const created = await createSession({
    attendance: { connect: { id: attendance.id } },
    checkInAt: now,
    checkInLat: hasLocation ? input.lat : undefined,
    checkInLng: hasLocation ? input.lng : undefined,
    checkInAccuracy: hasLocation ? input.accuracy : undefined,
    checkInDeviceAt:
      hasLocation && input.deviceTimestamp ? new Date(input.deviceTimestamp) : undefined,
    createdBy: user.id,
    updatedBy: user.id,
  });

  await deriveStatusSafely(user.id, today, user.id);

  return toSessionSummary(created);
}

export async function checkOut(
  userId: string,
  input: CheckOutInput,
): Promise<AttendanceSessionSummary> {
  const user = await findUserById(userId);
  if (!user) throw new UserNotFoundError();

  const now = new Date();
  const today = startOfUtcDay(now);

  const existing = await findAttendanceWithSessions(user.id, today);
  const openSession = existing?.sessions.find((session) => session.checkOutAt === null);
  // Deliberately returns an explicit error rather than falling through to
  // creating a new session — a check-out with nothing open would be an
  // orphan record with no start time, which corrupts duration and status
  // derivation downstream. Covers both "never checked in today" and
  // "already checked out, nothing open right now" with one message.
  if (!openSession) throw new NoCheckInFoundError();

  // Same accuracy threshold and requiresLocation resolution as check-in —
  // a low-accuracy or missing fix is just as unreliable on the way out.
  const requiresLocation = resolveRequiresLocation(user);
  const hasLocation = input.lat !== undefined;

  if (requiresLocation && !hasLocation) {
    throw new LocationRequiredError();
  }
  // Only rejects above the higher ceiling now — a fix between the two
  // thresholds is accepted and stored, with NEEDS_REVIEW (derived in
  // attendance-status-service.ts) flagging it for a supervisor afterward
  // rather than blocking the delegate outright.
  if (hasLocation && input.accuracy! > MAX_REJECTABLE_ACCURACY_METERS) {
    throw new LocationAccuracyTooLowError();
  }

  const updated = await updateSession(openSession.id, {
    checkOutAt: now,
    checkOutLat: hasLocation ? input.lat : undefined,
    checkOutLng: hasLocation ? input.lng : undefined,
    checkOutAccuracy: hasLocation ? input.accuracy : undefined,
    checkOutDeviceAt:
      hasLocation && input.deviceTimestamp ? new Date(input.deviceTimestamp) : undefined,
    updatedBy: user.id,
  });

  await deriveStatusSafely(user.id, today, user.id);

  return toSessionSummary(updated);
}
