import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { ActivityCalendar } from "./activity-calendar";
import { ActivityMonthSelect } from "./activity-month-select";

type AssignmentEntry = {
  id: string;
  scheduledDate: Date;
  activity: { type: string; name: string };
};

// The month nav row (today/prev/next/month-year picker) plus the grid
// itself — shared by the team-wide calendar and the personal one nested
// under My Activities, which differ only in `basePath` and which
// assignments were fetched to fill it.
export function ActivityCalendarBody({
  year,
  month,
  urlMonth,
  basePath,
  language,
  assignments,
  dict,
}: {
  year: number;
  month: number;
  urlMonth: number;
  basePath: string;
  language: string;
  assignments: AssignmentEntry[];
  dict: Dictionary["activitiesPage"];
}) {
  const now = new Date();
  const prevMonth = urlMonth === 1 ? { year: year - 1, month: 12 } : { year, month: urlMonth - 1 };
  const nextMonth = urlMonth === 12 ? { year: year + 1, month: 1 } : { year, month: urlMonth + 1 };
  const todayHref = `${basePath}?year=${now.getUTCFullYear()}&month=${now.getUTCMonth() + 1}`;

  const monthLabel = new Intl.DateTimeFormat(language, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month, 1)));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold capitalize">{monthLabel}</h2>
        <div className="flex items-center gap-2">
          <ActivityMonthSelect
            year={year}
            month={urlMonth}
            language={language}
            basePath={basePath}
          />
          <Button render={<Link href={todayHref} />} variant="outline">
            {dict.today}
          </Button>
          <Button
            render={<Link href={`${basePath}?year=${prevMonth.year}&month=${prevMonth.month}`} />}
            variant="outline"
            size="icon"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            render={<Link href={`${basePath}?year=${nextMonth.year}&month=${nextMonth.month}`} />}
            variant="outline"
            size="icon"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <ActivityCalendar
        year={year}
        month={month}
        entries={assignments.map((assignment) => ({
          id: assignment.id,
          date: assignment.scheduledDate,
          type: assignment.activity.type,
          name: assignment.activity.name,
        }))}
      />
    </>
  );
}
