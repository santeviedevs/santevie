import { findHolidaysInRange } from "@/server/repositories/holiday-repository";
import { findLeavesOverlappingRange } from "@/server/repositories/leave-repository";
import { listWorkingDays } from "@/server/repositories/working-day-repository";

export type CalendarLeaveStatus = "PENDING" | "APPROVED" | "REJECTED";

export type CalendarDay = {
  date: string; // "YYYY-MM-DD"
  inCurrentMonth: boolean;
  isWorkingDay: boolean;
  holiday: { name: string } | null;
  leave: { leaveType: string; status: CalendarLeaveStatus } | null;
};

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// The 42-cell (6-row) grid a month calendar renders: starts on the Sunday
// on or before the 1st of the month, ends on the Saturday on or after the
// last day, so every week row is complete. Days outside the requested
// month carry inCurrentMonth: false and are never enriched with holiday/
// leave data below, regardless of what exists in the DB for them — the UI
// renders them greyed out with no badges.
function buildGridRange(year: number, month: number): { start: Date; end: Date } {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const start = new Date(firstOfMonth);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());

  const lastOfMonth = new Date(Date.UTC(year, month, 0));
  const end = new Date(lastOfMonth);
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));

  return { start, end };
}

// Territory resolution matches isWorkingDay() in working-day-service.ts:
// the viewer's home territory (User.territoryId), same choice made for
// S3-04 attendance derivation, kept consistent here. A null territoryId
// (defensive — every seeded user has one) fails open: every day reads as
// working, no holidays, same as isWorkingDay's own fail-open behavior.
export async function getMyCalendarMonth(
  userId: string,
  territoryId: string | null,
  year: number,
  month: number,
): Promise<CalendarDay[]> {
  const { start, end } = buildGridRange(year, month);

  const [workingDayRows, holidays, leaves] = await Promise.all([
    territoryId ? listWorkingDays(territoryId) : Promise.resolve([]),
    territoryId ? findHolidaysInRange(territoryId, start, end) : Promise.resolve([]),
    findLeavesOverlappingRange(userId, start, end),
  ]);

  const workingByDayOfWeek = new Map(workingDayRows.map((row) => [row.dayOfWeek, row.isWorking]));

  const days: CalendarDay[] = [];
  for (
    let cursor = new Date(start);
    cursor.getTime() <= end.getTime();
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const date = new Date(cursor);
    const dayOfWeek = date.getUTCDay();
    const inCurrentMonth = date.getUTCMonth() === month - 1 && date.getUTCFullYear() === year;

    const holiday = inCurrentMonth
      ? (holidays.find((h) => h.startDate <= date && h.endDate >= date) ?? null)
      : null;
    const leave = inCurrentMonth
      ? (leaves.find((l) => l.startDate <= date && l.endDate >= date) ?? null)
      : null;

    days.push({
      date: toDateKey(date),
      inCurrentMonth,
      isWorkingDay: workingByDayOfWeek.get(dayOfWeek) ?? true,
      holiday: holiday ? { name: holiday.name } : null,
      leave: leave ? { leaveType: leave.leaveType.name, status: leave.status } : null,
    });
  }

  return days;
}
