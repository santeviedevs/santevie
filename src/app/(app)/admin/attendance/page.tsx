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
import { formatDateTime } from "@/lib/format-date";
import { getServerDictionary } from "@/lib/i18n/server";
import { totalPages } from "@/lib/pagination";
import { attendanceReportFiltersSchema } from "@/lib/schemas/attendance-report";
import { requireAnyPermission } from "@/server/auth/require-permission";
import { listActiveUserOptions } from "@/server/repositories/user-repository";
import { getAttendanceReport } from "@/server/services/attendance-report-service";
import { listActiveTerritoryOptions } from "@/server/services/territory-service";

import { AttendanceFilters } from "./attendance-filters";
import type { AttendanceMapPoint } from "./attendance-map";
import { AttendanceMap } from "./attendance-map";

export const dynamic = "force-dynamic";

type AttendancePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

export default async function AttendanceAdminPage({ searchParams }: AttendancePageProps) {
  const session = await requireAnyPermission(["reports:view-team", "reports:view-all"]);
  const dict = await getServerDictionary();
  const t = dict.attendanceAdminPage;

  const params = await searchParams;
  const filters = attendanceReportFiltersSchema.parse({
    employeeId: firstValue(params.employeeId),
    territoryId: firstValue(params.territoryId),
    dateFrom: firstValue(params.dateFrom),
    dateTo: firstValue(params.dateTo),
    status: firstValue(params.status),
    page: firstValue(params.page),
    pageSize: firstValue(params.pageSize),
  });

  const [{ items: records, total }, territories, employees] = await Promise.all([
    getAttendanceReport(filters, session),
    listActiveTerritoryOptions(),
    listActiveUserOptions(),
  ]);

  const mapPoints: AttendanceMapPoint[] = records.flatMap((record) =>
    record.sessions.flatMap((session) => {
      const points: AttendanceMapPoint[] = [];
      if (session.checkInLat !== null && session.checkInLng !== null) {
        points.push({
          id: session.id,
          kind: "check-in",
          latitude: session.checkInLat,
          longitude: session.checkInLng,
          label: `${record.employee.name} — ${t.checkInLabel}`,
        });
      }
      if (session.checkOutLat !== null && session.checkOutLng !== null) {
        points.push({
          id: session.id,
          kind: "check-out",
          latitude: session.checkOutLat,
          longitude: session.checkOutLng,
          label: `${record.employee.name} — ${t.checkOutLabel}`,
        });
      }
      return points;
    }),
  );

  const exportParams = new URLSearchParams();
  if (filters.employeeId) exportParams.set("employeeId", filters.employeeId);
  if (filters.territoryId) exportParams.set("territoryId", filters.territoryId);
  if (filters.dateFrom) exportParams.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) exportParams.set("dateTo", filters.dateTo);
  if (filters.status) exportParams.set("status", filters.status);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t.title}</h1>
        <div className="flex gap-2">
          <Button render={<Link href="/admin/attendance/daily-team-view" />} variant="outline">
            {t.dailyTeamView}
          </Button>
          <Button render={<a href={`/api/attendance/export?${exportParams.toString()}`} />}>
            {t.export}
          </Button>
        </div>
      </div>

      <AttendanceFilters
        employees={employees.map((e) => ({ id: e.id, label: e.name }))}
        territories={territories.map((t2) => ({ id: t2.id, label: t2.label }))}
        filters={filters}
        dict={t}
      />

      <AttendanceMap points={mapPoints} />

      <div className="min-w-0 rounded-md border border-border p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columnDate}</TableHead>
              <TableHead>{t.columnEmployee}</TableHead>
              <TableHead>{t.columnTerritory}</TableHead>
              <TableHead>{t.columnStatus}</TableHead>
              <TableHead>{t.columnSessions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id}>
                <TableCell>{formatDateTime(record.date)}</TableCell>
                <TableCell>
                  <Link href={`/admin/attendance/${record.id}`} className="underline">
                    {record.employee.name}
                  </Link>
                </TableCell>
                <TableCell>{record.territory?.code ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{record.status}</Badge>
                </TableCell>
                <TableCell>{record.sessions.length}</TableCell>
              </TableRow>
            ))}
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
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
