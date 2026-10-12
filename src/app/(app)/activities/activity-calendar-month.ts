// Shared by the team-wide calendar (/activities/calendar) and the personal
// one nested under My Activities (/activities/my/calendar): parses the
// year/month URL params into a safe, bounded month to query. `month` stays
// 0-indexed internally (matches Date#getUTCMonth()); the URL param and
// ActivityMonthSelect's own value are 1-indexed.
export function parseCalendarMonthParams(
  params: { year?: string; month?: string },
  now: Date = new Date(),
): { year: number; month: number; urlMonth: number } {
  const parsedYear = Number(params.year);
  const parsedMonth = Number(params.month);
  // A malformed or out-of-range param falls back to the current month: the
  // month bounds a database query, so NaN must never reach it.
  const year =
    Number.isInteger(parsedYear) && parsedYear >= 1970 && parsedYear <= 2200
      ? parsedYear
      : now.getUTCFullYear();
  const month =
    Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
      ? parsedMonth - 1
      : now.getUTCMonth();
  return { year, month, urlMonth: month + 1 };
}
