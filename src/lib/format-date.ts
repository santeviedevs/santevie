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
