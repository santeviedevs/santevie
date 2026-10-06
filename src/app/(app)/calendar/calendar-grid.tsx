import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CalendarDay } from "@/server/services/calendar-service";

const LEAVE_STATUS_VARIANT = {
  APPROVED: "default",
  PENDING: "secondary",
  REJECTED: "destructive",
} as const;

function dayNumber(dateKey: string): number {
  return Number(dateKey.slice(8, 10));
}

export function CalendarGrid({ days, language }: { days: CalendarDay[]; language: string }) {
  const weekdayFormatter = new Intl.DateTimeFormat(language, { weekday: "short", timeZone: "UTC" });
  // Any Sunday-starting week from the grid gives every weekday label once,
  // in order — cheaper than a separate lookup table to translate.
  const weekdayLabels = days
    .slice(0, 7)
    .map((day) => weekdayFormatter.format(new Date(`${day.date}T00:00:00Z`)));

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-muted/50">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase"
          >
            {label}
          </div>
        ))}
      </div>

      {weeks.map((week, weekIndex) => (
        <div key={weekIndex} className="grid grid-cols-7">
          {week.map((day) => (
            <div
              key={day.date}
              className={cn(
                "flex min-h-28 flex-col gap-1 border-b border-r border-border p-2 last:border-r-0",
                !day.inCurrentMonth && "bg-muted/20 text-muted-foreground",
                day.inCurrentMonth && !day.isWorkingDay && !day.holiday && "bg-muted/40",
              )}
            >
              <span className={cn("text-sm", !day.inCurrentMonth && "text-muted-foreground/60")}>
                {dayNumber(day.date)}
              </span>

              {day.inCurrentMonth && day.holiday ? (
                <Badge variant="destructive" className="w-fit max-w-full truncate">
                  {day.holiday.name}
                </Badge>
              ) : null}

              {day.inCurrentMonth && day.leave ? (
                <Badge
                  variant={LEAVE_STATUS_VARIANT[day.leave.status]}
                  className="w-fit max-w-full truncate"
                >
                  {day.leave.leaveType}
                </Badge>
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
