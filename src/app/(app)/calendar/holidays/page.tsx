import Link from "next/link";

import { PaginationControls } from "@/components/pagination-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format-date";
import { getServerDictionary } from "@/lib/i18n/server";
import { totalPages } from "@/lib/pagination";
import { holidayFiltersSchema } from "@/lib/schemas/holiday";
import { hasPermission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";
import { listHolidays } from "@/server/services/holiday-service";
import { listActiveTerritoryOptions } from "@/server/services/territory-service";

import { CalendarTabs } from "../calendar-tabs";
import { HolidayFilters } from "./holiday-filters";

export const dynamic = "force-dynamic";

type HolidaysPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

export default async function HolidaysPage({ searchParams }: HolidaysPageProps) {
  // Everyone can view the holiday calendar; only holidays:manage holders
  // get the Add/Edit actions below (checked separately, not by this gate —
  // requirePermission("holidays:view") alone lets every role reach this
  // page).
  const session = await requirePermission("holidays:view");
  const canManage = hasPermission(session.user.permissions, "holidays:manage");

  const params = await searchParams;
  const filters = holidayFiltersSchema.parse({
    territoryId: firstValue(params.territoryId),
    year: firstValue(params.year),
    page: firstValue(params.page),
    pageSize: firstValue(params.pageSize),
  });

  const [{ items: holidays, total }, territories, dict] = await Promise.all([
    listHolidays(filters),
    listActiveTerritoryOptions(),
    getServerDictionary(),
  ]);
  const t = dict.holidaysPage;

  // A holiday calendar is planned a year or two ahead and rarely revisited
  // far in the past — a fixed window around the current year covers the
  // real workflow without an extra "distinct years in the table" query.
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);

  return (
    <div className="flex flex-col gap-6 p-6">
      <CalendarTabs active="holidays" dict={dict.calendarPage} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t.title}</h1>
        {canManage ? (
          <Button render={<Link href="/calendar/holidays/new" />}>{t.newHoliday}</Button>
        ) : null}
      </div>

      <HolidayFilters
        territories={territories.map((territory) => ({
          id: territory.id,
          code: territory.code,
          label: territory.label,
        }))}
        years={years}
        filters={filters}
        dict={t}
      />

      <div className="min-w-0 rounded-md border border-border p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columnDates}</TableHead>
              <TableHead>{t.columnName}</TableHead>
              <TableHead>{t.columnTerritory}</TableHead>
              <TableHead>{t.columnStatus}</TableHead>
              {canManage ? <TableHead /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {holidays.map((holiday) => (
              <TableRow key={holiday.id}>
                <TableCell>
                  {formatDate(holiday.startDate)}
                  {holiday.startDate.getTime() !== holiday.endDate.getTime()
                    ? ` – ${formatDate(holiday.endDate)}`
                    : ""}
                </TableCell>
                <TableCell>{holiday.name}</TableCell>
                <TableCell>
                  {holiday.territory ? holiday.territory.code : t.allTerritories}
                </TableCell>
                <TableCell>
                  <Badge variant={holiday.status === "ACTIVE" ? "default" : "secondary"}>
                    {holiday.status === "ACTIVE" ? t.statusActive : t.statusInactive}
                  </Badge>
                </TableCell>
                {canManage ? (
                  <TableCell className="flex justify-end">
                    <Button
                      render={<Link href={`/calendar/holidays/${holiday.id}`} />}
                      variant="outline"
                      size="sm"
                    >
                      {t.edit}
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
            {holidays.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 5 : 4}
                  className="text-center text-muted-foreground"
                >
                  {t.noResults}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <PaginationControls
        page={filters.page}
        pageSize={filters.pageSize}
        total={total}
        previousLabel={dict.pagination.previous}
        nextLabel={dict.pagination.next}
        pageInfoLabel={dict.pagination.pageInfo(
          filters.page,
          totalPages(total, filters.pageSize),
          total,
        )}
      />
    </div>
  );
}
