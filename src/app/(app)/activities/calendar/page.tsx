import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getLanguage, getServerDictionary } from "@/lib/i18n/server";
import { hasPermission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";
import { getActivitiesForMonth } from "@/server/services/activity-service";

import { ActivityCalendar } from "../activity-calendar";
import { ActivityMonthSelect } from "../activity-month-select";
import { ActivityTabs } from "../activity-tabs";

export const dynamic = "force-dynamic";

type CalendarPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ActivityCalendarPage({ searchParams }: CalendarPageProps) {
  const session = await requirePermission("activities:respond-own");
  const [dict, language] = await Promise.all([getServerDictionary(), getLanguage()]);
  const t = dict.activitiesPage;

  const params = await searchParams;
  const now = new Date();
  const yearParam = Array.isArray(params.year) ? params.year[0] : params.year;
  const monthParam = Array.isArray(params.month) ? params.month[0] : params.month;
  // A malformed or out-of-range param falls back to the current month: the
  // month now bounds a database query, so NaN must never reach it.
  const parsedYear = Number(yearParam);
  const parsedMonth = Number(monthParam);
  const year =
    Number.isInteger(parsedYear) && parsedYear >= 1970 && parsedYear <= 2200
      ? parsedYear
      : now.getUTCFullYear();
  // `month` stays 0-indexed internally (matches Date#getUTCMonth()); the URL
  // param and ActivityMonthSelect's own value are 1-indexed, same convention
  // calendar/page.tsx already uses for /calendar.
  const month =
    Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
      ? parsedMonth - 1
      : now.getUTCMonth();
  const urlMonth = month + 1;

  const canAssign = hasPermission(session.user.permissions, "activities:assign");
  const monthActivities = await getActivitiesForMonth(session, canAssign, year, month);

  const prevMonth = urlMonth === 1 ? { year: year - 1, month: 12 } : { year, month: urlMonth - 1 };
  const nextMonth = urlMonth === 12 ? { year: year + 1, month: 1 } : { year, month: urlMonth + 1 };
  const base = "/activities/calendar";
  const todayHref = `${base}?year=${now.getUTCFullYear()}&month=${now.getUTCMonth() + 1}`;

  const monthLabel = new Intl.DateTimeFormat(language, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month, 1)));

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">
        {canAssign ? t.activityListTitle : t.myActivitiesTitle}
      </h1>
      <ActivityTabs active="calendar" canAssign={canAssign} dict={t} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold capitalize">{monthLabel}</h2>
        <div className="flex items-center gap-2">
          <ActivityMonthSelect year={year} month={urlMonth} language={language} />
          <Button render={<Link href={todayHref} />} variant="outline">
            {t.today}
          </Button>
          <Button
            render={<Link href={`${base}?year=${prevMonth.year}&month=${prevMonth.month}`} />}
            variant="outline"
            size="icon"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            render={<Link href={`${base}?year=${nextMonth.year}&month=${nextMonth.month}`} />}
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
        entries={monthActivities.map((a) => ({
          id: a.id,
          date: a.date,
          type: a.type,
          status: a.status,
        }))}
      />
    </div>
  );
}
