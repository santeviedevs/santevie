import { getLanguage, getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getAssignmentsForMonth } from "@/server/services/activity-service";

import { ActivityCalendarBody } from "../activity-calendar-body";
import { parseCalendarMonthParams } from "../activity-calendar-month";
import { ActivityTabs } from "../activity-tabs";

export const dynamic = "force-dynamic";

type CalendarPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// The team-wide calendar — part of the manager-only Activity List /
// Assignment / Calendar group. A delegate or supervisor without
// activities:assign has no team to see here; their own schedule is the
// separate Calendar tab under My Activities.
export default async function ActivityCalendarPage({ searchParams }: CalendarPageProps) {
  const session = await requirePermission("activities:assign");
  const [dict, language] = await Promise.all([getServerDictionary(), getLanguage()]);
  const t = dict.activitiesPage;

  const params = await searchParams;
  const yearParam = Array.isArray(params.year) ? params.year[0] : params.year;
  const monthParam = Array.isArray(params.month) ? params.month[0] : params.month;
  const { year, month, urlMonth } = parseCalendarMonthParams({
    year: yearParam,
    month: monthParam,
  });

  const monthAssignments = await getAssignmentsForMonth(session, true, year, month);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{t.title}</h1>
      <ActivityTabs active="calendar" canAssign dict={t} />

      <ActivityCalendarBody
        year={year}
        month={month}
        urlMonth={urlMonth}
        basePath="/activities/calendar"
        language={language}
        assignments={monthAssignments}
        dict={t}
      />
    </div>
  );
}
