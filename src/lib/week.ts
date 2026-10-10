import { KINSHASA_UTC_OFFSET_MINUTES } from "./format-date";

// Every business date here is a calendar date stored at UTC midnight and
// interpreted in Africa/Kinshasa (UTC+1, no DST) — the app's one timezone
// convention (see format-date.ts). Weeks start on Monday and end on Sunday.
// Route assignment and the Home screen both use these helpers, so a route
// can never be placed in conflicting weeks.

const DAY_MS = 24 * 60 * 60 * 1000;

export type DateRange = { start: Date; end: Date };

// "Today" as a calendar date (UTC midnight) in Kinshasa — e.g. at
// 2026-06-14T23:30Z it is already the 15th there.
export function todayInKinshasa(now: Date = new Date()): Date {
  const local = new Date(now.getTime() + KINSHASA_UTC_OFFSET_MINUTES * 60 * 1000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

// "2026-06-15" -> that calendar date at UTC midnight.
export function parseDateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

// The Monday on or before `date`.
export function startOfWeek(date: Date): Date {
  const sinceMonday = (date.getUTCDay() + 6) % 7;
  return addDays(date, -sinceMonday);
}

export function weekContaining(date: Date): DateRange {
  const start = startOfWeek(date);
  return { start, end: addDays(start, 6) };
}

// The current working week and the single week after it, as of `now`.
export function currentAndUpcomingWeeks(now: Date = new Date()): {
  thisWeek: DateRange;
  upcomingWeek: DateRange;
} {
  const thisWeek = weekContaining(todayInKinshasa(now));
  return { thisWeek, upcomingWeek: weekContaining(addDays(thisWeek.start, 7)) };
}

// Inclusive on both ends: a range ending on the 21st and one starting on the
// 21st share a day.
export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start.getTime() <= b.end.getTime() && a.end.getTime() >= b.start.getTime();
}
