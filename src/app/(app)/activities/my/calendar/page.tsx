import { getLanguage, getServerDictionary } from "@/lib/i18n/server";
import { hasPermission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";
import { getAssignmentsForMonth } from "@/server/services/activity-service";

import { ActivityCalendarBody } from "../../activity-calendar-body";
import { parseCalendarMonthParams } from "../../activity-calendar-month";
import { MyActivitiesTabs } from "../my-activities-tabs";

export const dynamic = "force-dynamic";

type MyCalendarPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// The personal calendar under My Activities — always the viewer's own
// assignments (canAssign forced false below), regardless of role, same as
// the Activities tab on this screen. The team-wide calendar is the separate,
// manager-only /activities/calendar.
export default async function MyActivityCalendarPage({ searchParams }: MyCalendarPageProps) {
  const session = await requirePermission("activities:respond-own");
  const [dict, language] = await Promise.all([getServerDictionary(), getLanguage()]);
  const t = dict.activitiesPage;
  const canViewTeam = hasPermission(session.user.permissions, "activities:view-team");

  const params = await searchParams;
  const yearParam = Array.isArray(params.year) ? params.year[0] : params.year;
  const monthParam = Array.isArray(params.month) ? params.month[0] : params.month;
  const { year, month, urlMonth } = parseCalendarMonthParams({
    year: yearParam,
    month: monthParam,
  });

  const monthAssignments = await getAssignmentsForMonth(session, false, year, month);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{t.myActivitiesTitle}</h1>
      <MyActivitiesTabs active="calendar" canViewTeam={canViewTeam} dict={t} />

      <ActivityCalendarBody
        year={year}
        month={month}
        urlMonth={urlMonth}
        basePath="/activities/my/calendar"
        language={language}
        assignments={monthAssignments}
        dict={t}
      />
    </div>
  );
}
