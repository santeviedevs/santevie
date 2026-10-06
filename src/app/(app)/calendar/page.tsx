import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getLanguage, getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { findUserById } from "@/server/repositories/user-repository";
import { getMyCalendarMonth } from "@/server/services/calendar-service";

import { CalendarGrid } from "./calendar-grid";
import { CalendarMonthSelect } from "./calendar-month-select";
import { CalendarTabs } from "./calendar-tabs";

// A personal, user-scoped view (the viewer's own holidays/weekly-offs/leave
// status) — never statically cached, same reasoning as every other
// user-scoped page in this app (execution plan, section 4).
export const dynamic = "force-dynamic";

type CalendarPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

function clampMonth(month: number): number {
  return Math.min(12, Math.max(1, month));
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const session = await requirePermission("leave:view-own");

  const params = await searchParams;
  const now = new Date();
  const year = Number(firstValue(params.year)) || now.getUTCFullYear();
  const month = clampMonth(Number(firstValue(params.month)) || now.getUTCMonth() + 1);

  const [user, dict, language] = await Promise.all([
    findUserById(session.user.id),
    getServerDictionary(),
    getLanguage(),
  ]);
  const t = dict.calendarPage;

  const days = await getMyCalendarMonth(session.user.id, user?.territoryId ?? null, year, month);

  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const todayHref = `/calendar?year=${now.getUTCFullYear()}&month=${now.getUTCMonth() + 1}`;

  const monthLabel = new Intl.DateTimeFormat(language, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));

  return (
    <div className="flex flex-col gap-6 p-6">
      <CalendarTabs active="calendar" dict={t} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold capitalize">{monthLabel}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <CalendarMonthSelect year={year} month={month} language={language} />
          <Button render={<Link href={todayHref} />} variant="outline">
            {t.today}
          </Button>
          <Button
            render={<Link href={`/calendar?year=${prevMonth.year}&month=${prevMonth.month}`} />}
            variant="outline"
            size="icon"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            render={<Link href={`/calendar?year=${nextMonth.year}&month=${nextMonth.month}`} />}
            variant="outline"
            size="icon"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <CalendarGrid days={days} language={language} />

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Badge variant="destructive">{t.legendPublicHoliday}</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline">{t.legendWeeklyOff}</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="default">{t.legendApprovedLeave}</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary">{t.legendPendingLeave}</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="destructive">{t.legendRejectedLeave}</Badge>
        </div>
      </div>
    </div>
  );
}
