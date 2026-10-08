import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ActivityCalendarEntry = { id: string; date: Date; type: string; status: string };

// Self-contained month grid, deliberately not reusing calendar/calendar-grid.tsx
// — that component is tightly coupled to CalendarDay's holiday/leave shape
// (S3-01) and generalizing it for a different day-content shape would add
// more complexity than this small grid is worth.
function buildMonthDays(year: number, month: number): string[] {
  const first = new Date(Date.UTC(year, month, 1));
  const startOffset = first.getUTCDay(); // 0 = Sunday
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const days: string[] = [];
  for (let i = 0; i < startOffset; i++) days.push("");
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(Date.UTC(year, month, d)).toISOString().slice(0, 10));
  }
  return days;
}

export function ActivityCalendar({
  year,
  month,
  entries,
}: {
  year: number;
  month: number;
  entries: ActivityCalendarEntry[];
}) {
  const byDate = new Map<string, ActivityCalendarEntry[]>();
  for (const entry of entries) {
    const key = entry.date.toISOString().slice(0, 10);
    const list = byDate.get(key) ?? [];
    list.push(entry);
    byDate.set(key, list);
  }

  const days = buildMonthDays(year, month);
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {weeks.map((week, weekIndex) => (
        <div key={weekIndex} className="grid grid-cols-7">
          {week.map((dateKey, dayIndex) => (
            <div
              key={dayIndex}
              className={cn(
                "flex min-h-24 flex-col gap-1 border-b border-r border-border p-2 last:border-r-0",
                !dateKey && "bg-muted/20",
              )}
            >
              {dateKey ? (
                <>
                  <span className="text-sm text-muted-foreground">
                    {Number(dateKey.slice(8, 10))}
                  </span>
                  {(byDate.get(dateKey) ?? []).map((entry) => (
                    <Badge key={entry.id} variant="secondary" className="w-fit max-w-full truncate">
                      {entry.type}
                    </Badge>
                  ))}
                </>
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
