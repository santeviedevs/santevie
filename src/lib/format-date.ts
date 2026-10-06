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
