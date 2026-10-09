import { KINSHASA_UTC_OFFSET_MINUTES } from "@/lib/format-date";
import { MAX_ACCEPTABLE_ACCURACY_METERS } from "@/lib/schemas/attendance";
import {
  findAttendanceWithSessions,
  updateAttendanceStatus,
} from "@/server/repositories/attendance-repository";
import { findUserById } from "@/server/repositories/user-repository";
import { resolveAttendanceThresholds } from "@/server/services/attendance-rule-service";
import { isWorkingDay } from "@/server/services/working-day-service";

import type { AttendanceStatus } from "../../../generated/prisma/client";

export type DerivationSession = {
  checkInAt: Date;
  checkInAccuracy: number | null;
  checkOutAt: Date | null;
  checkOutAccuracy: number | null;
};

export type DerivationThresholds = {
  expectedStartMinutes: number;
  lateGraceMinutes: number;
  minimumWorkedMinutes: number;
};

// Minutes-since-local-midnight (Africa/Kinshasa, fixed UTC+1) for a UTC
// timestamp — expectedStartMinutes is configured in local terms (an admin
// typing "09:00" means 9am Kinshasa time), so a check-in's UTC clock time
// must be shifted the same way before the two are compared.
function localMinutesOfDay(date: Date): number {
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  return (utcMinutes + KINSHASA_UTC_OFFSET_MINUTES + 1440) % 1440;
}

// Pure, side-effect-free — the actual S3-04 acceptance criterion ("status
// derivation service that is idempotent and safe to re-run") lives here:
// given the same sessions/isWorkingDay/thresholds, this always returns the
// same status, with no read or write of its own. Priority order, each
// short-circuiting the next:
//   1. NON_WORKING — a holiday or approved leave; never ABSENT for this case
//      (doc requirement: holidays/leave are not attendance failures).
//   2. ABSENT — a working day with no session at all.
//   3. NEEDS_REVIEW — a session exists but its GPS fix (check-in or
//      check-out) is below the accuracy threshold; too unreliable to trust
//      either LATE/PRESENT or INCOMPLETE, needs a human to look at it.
//   4. INCOMPLETE — any session still has no check-out, or the day's total
//      worked minutes fall under the configured minimum.
//   5. LATE — the earliest check-in is later than expectedStartMinutes +
//      lateGraceMinutes.
//   6. PRESENT — none of the above; checked in on time, worked a full day.
export function deriveAttendanceStatus(params: {
  sessions: DerivationSession[];
  isWorkingDay: boolean;
  thresholds: DerivationThresholds;
}): AttendanceStatus {
  if (!params.isWorkingDay) return "NON_WORKING";
  if (params.sessions.length === 0) return "ABSENT";

  const hasPoorAccuracy = params.sessions.some(
    (session) =>
      (session.checkInAccuracy !== null &&
        session.checkInAccuracy > MAX_ACCEPTABLE_ACCURACY_METERS) ||
      (session.checkOutAccuracy !== null &&
        session.checkOutAccuracy > MAX_ACCEPTABLE_ACCURACY_METERS),
  );
  if (hasPoorAccuracy) return "NEEDS_REVIEW";

  const hasOpenSession = params.sessions.some((session) => session.checkOutAt === null);
  const totalWorkedMinutes = params.sessions.reduce((sum, session) => {
    if (!session.checkOutAt) return sum;
    return sum + (session.checkOutAt.getTime() - session.checkInAt.getTime()) / 60000;
  }, 0);

  if (hasOpenSession || totalWorkedMinutes < params.thresholds.minimumWorkedMinutes) {
    return "INCOMPLETE";
  }

  const earliestCheckIn = params.sessions.reduce(
    (earliest, session) => (session.checkInAt < earliest ? session.checkInAt : earliest),
    params.sessions[0]!.checkInAt,
  );
  const lateCutoff = params.thresholds.expectedStartMinutes + params.thresholds.lateGraceMinutes;

  if (localMinutesOfDay(earliestCheckIn) > lateCutoff) return "LATE";

  return "PRESENT";
}

// Orchestration: loads a day's working-day status, resolved thresholds, and
// sessions, derives the status via the pure function above, and persists
// it. Safe to call repeatedly for the same (userId, date) — every input it
// reads is itself stable for a past date (isWorkingDay reads holiday/leave
// records that don't change retroactively in practice, and
// resolveAttendanceThresholds is explicitly designed to return the same
// answer for a past date regardless of when it's called).
//
// Called event-driven from checkIn()/checkOut() in attendance-service.ts
// (wrapped there so a derivation failure never blocks the check-in/out
// itself) — covers LATE/PRESENT/INCOMPLETE/NEEDS_REVIEW live. It does NOT
// cover ABSENT or NON_WORKING for a day with zero sessions: there's no
// check-in/check-out event to hook into when nobody shows up at all. That
// case is a separate, still-open design decision (computed-at-read vs. a
// scheduled sweep), not yet implemented either way.
export async function deriveAndPersistAttendanceStatus(
  userId: string,
  date: Date,
  actorId: string,
): Promise<AttendanceStatus | null> {
  const [attendance, user] = await Promise.all([
    findAttendanceWithSessions(userId, date),
    findUserById(userId),
  ]);
  if (!attendance || !user) return null;

  // A null territoryId fails open (treated as working) — same choice
  // checkIn() in attendance-service.ts already makes.
  const [working, thresholds] = await Promise.all([
    user.territoryId ? isWorkingDay(date, user.territoryId, userId) : Promise.resolve(true),
    resolveAttendanceThresholds(userId, date),
  ]);

  const status = deriveAttendanceStatus({
    sessions: attendance.sessions.map((session) => ({
      checkInAt: session.checkInAt,
      checkInAccuracy: session.checkInAccuracy === null ? null : Number(session.checkInAccuracy),
      checkOutAt: session.checkOutAt,
      checkOutAccuracy: session.checkOutAccuracy === null ? null : Number(session.checkOutAccuracy),
    })),
    isWorkingDay: working,
    thresholds,
  });

  await updateAttendanceStatus(attendance.id, status, actorId);
  return status;
}
