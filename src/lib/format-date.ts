// Calendar dates only (no time-of-day) — contractStartDate/contractExpiryDate
// are Prisma @db.Date columns, so formatting reads the UTC calendar date
// directly rather than converting through a timezone.
const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(date: Date | string): string {
  return dateFormatter.format(typeof date === "string" ? new Date(date) : date);
}

// Africa/Kinshasa has a fixed UTC+1 offset, no DST — used wherever a
// UTC timestamp needs converting to a local minutes-since-midnight value
// (e.g. attendance-status-service.ts comparing a check-in time against a
// configured expected-start time), not just for display formatting.
export const KINSHASA_UTC_OFFSET_MINUTES = 60;

// Real timestamps (DateTime columns, e.g. Attendance.checkInAt) are stored
// in UTC and rendered in Africa/Kinshasa (DR Congo, UTC+1, no DST) — the
// client's actual territory data (prisma/seed.ts: Équateur > Mbandaka >
// Wangata > Bongondo) is DRC, not the UAE the execution plan assumed —
// unlike formatDate above, which is only for @db.Date columns that have no
// time-of-day or timezone to convert.
const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Kinshasa",
});

export function formatDateTime(date: Date | string): string {
  return dateTimeFormatter.format(typeof date === "string" ? new Date(date) : date);
}

// Time-of-day only, same Africa/Kinshasa rendering rule as formatDateTime —
// for columns like a history table's Check-In/Check-Out cells where the
// date is already shown in its own column.
const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Kinshasa",
});

export function formatTime(date: Date | string): string {
  return timeFormatter.format(typeof date === "string" ? new Date(date) : date);
}

// The calendar-date portion of a real timestamp (e.g. a session's
// checkInAt), rendered in Africa/Kinshasa — distinct from formatDate above,
// which is for @db.Date columns that have no time-of-day or timezone to
// convert in the first place.
const timestampDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Africa/Kinshasa",
});

export function formatTimestampDate(date: Date | string): string {
  return timestampDateFormatter.format(typeof date === "string" ? new Date(date) : date);
}

// A date range for display — one date when the range is a single day,
// otherwise "start – end". Both are @db.Date-style calendar dates, so the
// same UTC rendering as formatDate applies.
export function formatDateRange(start: Date | string, end: Date | string): string {
  const from = formatDate(start);
  const to = formatDate(end);
  return from === to ? from : `${from} – ${to}`;
}
