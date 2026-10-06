import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

const sessionOrderByNewest = {
  checkInAt: "desc",
} satisfies Prisma.AttendanceSessionOrderByWithRelationInput;

export type AttendanceSessionRow = Prisma.AttendanceSessionGetPayload<object>;

const attendanceWithSessionsInclude = {
  sessions: { orderBy: sessionOrderByNewest },
} satisfies Prisma.AttendanceInclude;

export type AttendanceWithSessions = Prisma.AttendanceGetPayload<{
  include: typeof attendanceWithSessionsInclude;
}>;

// `date` must already be normalized to midnight UTC (see startOfUtcDay in
// attendance-service.ts) — this is a straight lookup against the
// @@unique([userId, date]) row, not a range query. Sessions come back
// newest-first since every caller wants "latest session" or a
// newest-first history list, never oldest-first.
export function findAttendanceWithSessions(
  userId: string,
  date: Date,
): Promise<AttendanceWithSessions | null> {
  return prisma.attendance.findUnique({
    where: { userId_date: { userId, date } },
    include: attendanceWithSessionsInclude,
  });
}

// Ensures today's day-level row exists without clobbering it on a second
// (or third...) check-in the same day — update: {} leaves an existing row
// untouched, only the create branch of the upsert ever runs once per day.
export function upsertAttendanceDay(
  userId: string,
  date: Date,
  actorId: string,
): Promise<Prisma.AttendanceGetPayload<object>> {
  return prisma.attendance.upsert({
    where: { userId_date: { userId, date } },
    update: {},
    create: { user: { connect: { id: userId } }, date, createdBy: actorId, updatedBy: actorId },
  });
}

export function createSession(
  data: Prisma.AttendanceSessionCreateInput,
): Promise<AttendanceSessionRow> {
  return prisma.attendanceSession.create({ data });
}

export function updateSession(
  id: string,
  data: Prisma.AttendanceSessionUpdateInput,
): Promise<AttendanceSessionRow> {
  return prisma.attendanceSession.update({ where: { id }, data });
}

// Every session for a user across all days, newest first — backs the
// delegate's own paginated Check-In/Out history (not the cross-team
// reporting that S3-05's attendance administration screen will add).
export async function findSessionsForUser(
  userId: string,
  skip: number,
  take: number,
): Promise<{ items: AttendanceSessionRow[]; total: number }> {
  const [items, total] = await Promise.all([
    prisma.attendanceSession.findMany({
      where: { attendance: { userId } },
      orderBy: sessionOrderByNewest,
      skip,
      take,
    }),
    prisma.attendanceSession.count({ where: { attendance: { userId } } }),
  ]);
  return { items, total };
}
