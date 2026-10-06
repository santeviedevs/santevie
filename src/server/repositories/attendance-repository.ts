import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

const attendanceInclude = {
  user: { select: { id: true, name: true, employeeCode: true } },
} satisfies Prisma.AttendanceInclude;

export type AttendanceRow = Prisma.AttendanceGetPayload<{ include: typeof attendanceInclude }>;

// `date` must already be normalized to midnight UTC (see startOfUtcDay in
// attendance-service.ts) — this is a straight lookup against the
// @@unique([userId, date]) row, not a range query.
export function findAttendanceForDate(userId: string, date: Date): Promise<AttendanceRow | null> {
  return prisma.attendance.findUnique({
    where: { userId_date: { userId, date } },
    include: attendanceInclude,
  });
}

export function createCheckIn(data: Prisma.AttendanceCreateInput): Promise<AttendanceRow> {
  return prisma.attendance.create({ data, include: attendanceInclude });
}
