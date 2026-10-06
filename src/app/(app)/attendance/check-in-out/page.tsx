import { PaginationControls } from "@/components/pagination-controls";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTime, formatTimestampDate } from "@/lib/format-date";
import { getServerDictionary } from "@/lib/i18n/server";
import { DEFAULT_PAGE_SIZE, paginationParamsSchema, totalPages } from "@/lib/pagination";
import { requireAnyPermission } from "@/server/auth/require-permission";
import {
  type AttendanceSessionSummary,
  getEffectiveRequiresLocation,
  getTodayAttendanceState,
  listMySessions,
} from "@/server/services/attendance-service";

import { CheckInOutCard } from "./check-in-out-card";

export const dynamic = "force-dynamic";

type CheckInOutPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours === 0 ? `${mins}m` : `${hours}h ${mins}m`;
}

export default async function CheckInOutPage({ searchParams }: CheckInOutPageProps) {
  const session = await requireAnyPermission(["attendance:check-in", "attendance:check-out"]);

  const params = await searchParams;
  const { page, pageSize } = paginationParamsSchema.parse({
    page: firstValue(params.page),
    pageSize: firstValue(params.pageSize) ?? String(DEFAULT_PAGE_SIZE),
  });

  const [requiresLocation, todayState, history, dict] = await Promise.all([
    getEffectiveRequiresLocation(session.user.id),
    getTodayAttendanceState(session.user.id),
    listMySessions(session.user.id, page, pageSize),
    getServerDictionary(),
  ]);
  const t = dict.checkInOutPage;

  function statusFor(row: AttendanceSessionSummary) {
    return row.checkOutAt === null ? (
      <Badge variant="secondary">{t.historyStatusActive}</Badge>
    ) : (
      <Badge variant="default">{t.historyStatusCompleted}</Badge>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{t.title}</h1>

      <CheckInOutCard todayState={todayState} requiresLocation={requiresLocation} dict={t} />

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t.historyTitle}</h2>
        <div className="min-w-0 rounded-md border border-border p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.historyColumnDate}</TableHead>
                <TableHead>{t.historyColumnCheckIn}</TableHead>
                <TableHead>{t.historyColumnCheckOut}</TableHead>
                <TableHead>{t.historyColumnDuration}</TableHead>
                <TableHead>{t.historyColumnStatus}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatTimestampDate(row.checkInAt)}</TableCell>
                  <TableCell>{formatTime(row.checkInAt)}</TableCell>
                  <TableCell>{row.checkOutAt ? formatTime(row.checkOutAt) : "—"}</TableCell>
                  <TableCell>
                    {row.durationMinutes === null ? "—" : formatDuration(row.durationMinutes)}
                  </TableCell>
                  <TableCell>{statusFor(row)}</TableCell>
                </TableRow>
              ))}
              {history.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {t.historyNoResults}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        <PaginationControls
          page={history.page}
          pageSize={history.pageSize}
          total={history.total}
          previousLabel={dict.pagination.previous}
          nextLabel={dict.pagination.next}
          pageInfoLabel={dict.pagination.pageInfo(
            history.page,
            totalPages(history.total, history.pageSize),
            history.total,
          )}
        />
      </div>
    </div>
  );
}
