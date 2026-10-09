import type { PagedResult } from "@/lib/pagination";
import type { AttendanceReportFilters } from "@/lib/schemas/attendance-report";
import {
  type AttendanceReportRow,
  countAttendanceRecords,
  findAttendanceById,
  findAttendanceForDate,
  findAttendanceRecords,
} from "@/server/repositories/attendance-report-repository";
import { getUserScope, isWithinScope, type ScopeSession, scopeUserIds } from "@/server/scope";

export type AttendanceReportSession = {
  id: string;
  checkInAt: Date;
  checkInLat: number | null;
  checkInLng: number | null;
  checkInAccuracy: number | null;
  checkOutAt: Date | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  checkOutAccuracy: number | null;
};

export type AttendanceReportSummary = {
  id: string;
  date: Date;
  status: string;
  employee: { id: string; name: string; employeeCode: string };
  territory: { id: string; code: string } | null;
  sessions: AttendanceReportSession[];
};

function toSummary(row: AttendanceReportRow): AttendanceReportSummary {
  return {
    id: row.id,
    date: row.date,
    status: row.status,
    employee: { id: row.user.id, name: row.user.name, employeeCode: row.user.employeeCode },
    territory: row.user.territory,
    sessions: row.sessions.map((session) => ({
      id: session.id,
      checkInAt: session.checkInAt,
      checkInLat: session.checkInLat === null ? null : Number(session.checkInLat),
      checkInLng: session.checkInLng === null ? null : Number(session.checkInLng),
      checkInAccuracy: session.checkInAccuracy === null ? null : Number(session.checkInAccuracy),
      checkOutAt: session.checkOutAt,
      checkOutLat: session.checkOutLat === null ? null : Number(session.checkOutLat),
      checkOutLng: session.checkOutLng === null ? null : Number(session.checkOutLng),
      checkOutAccuracy: session.checkOutAccuracy === null ? null : Number(session.checkOutAccuracy),
    })),
  };
}

// Resolves the viewer's hierarchy scope (scope.ts) intersected with any
// employeeId filter the caller requested. This intersection is the entire
// point: an employeeId outside the viewer's scope must resolve to an empty
// result set, never fall through to "scope ignored, employeeId used
// instead" — the repository layer trusts whatever list this returns.
async function resolveUserIds(
  filters: AttendanceReportFilters,
  session: ScopeSession,
): Promise<string[] | undefined> {
  const scope = await getUserScope(session);
  const scopedIds = scopeUserIds(scope);

  if (!filters.employeeId) return scopedIds;
  if (scopedIds === undefined) return [filters.employeeId];
  return scopedIds.includes(filters.employeeId) ? [filters.employeeId] : [];
}

export async function getAttendanceReport(
  filters: AttendanceReportFilters,
  session: ScopeSession,
): Promise<PagedResult<AttendanceReportSummary>> {
  const userIds = await resolveUserIds(filters, session);

  const [rows, total] = await Promise.all([
    findAttendanceRecords(filters, userIds),
    countAttendanceRecords(filters, userIds),
  ]);

  return { items: rows.map(toSummary), total, page: filters.page, pageSize: filters.pageSize };
}

// Section 9's execution-time watch-out: an export must stay inside a single
// request's time budget, so it's capped rather than streaming every row a
// wide-open filter could match. A caller hitting this ceiling needs to
// narrow their filters, not receive a silently truncated file — the route
// handler surfaces that rather than exporting a partial, unmarked result.
export const EXPORT_ROW_LIMIT = 5000;

export class ExportTooLargeError extends Error {
  constructor(total: number) {
    super(
      `This filter set matches ${total} records, over the ${EXPORT_ROW_LIMIT}-row export limit. Narrow the filters and try again.`,
    );
    this.name = "ExportTooLargeError";
  }
}

// Unpaginated — exactly the same filters and scope as the on-screen report
// (getAttendanceReport), so an export can never show different data than
// what the user was already looking at when they clicked export.
export async function getAttendanceReportForExport(
  filters: AttendanceReportFilters,
  session: ScopeSession,
): Promise<AttendanceReportSummary[]> {
  const userIds = await resolveUserIds(filters, session);

  const total = await countAttendanceRecords(filters, userIds);
  if (total > EXPORT_ROW_LIMIT) throw new ExportTooLargeError(total);

  const rows = await findAttendanceRecords(
    { ...filters, page: 1, pageSize: EXPORT_ROW_LIMIT },
    userIds,
  );
  return rows.map(toSummary);
}

// Drill-through target for the admin list/daily-team-view — explicitly
// scope-checked rather than relying on a filtered list query, since this is
// reached directly by id (a URL a supervisor could tamper with). Returns
// null both when the record doesn't exist and when it exists but falls
// outside the viewer's scope — the two must be indistinguishable to the
// caller, same as S1-07's "can't tell a hidden record from a missing one"
// rule.
export async function getAttendanceRecordById(
  id: string,
  session: ScopeSession,
): Promise<AttendanceReportSummary | null> {
  const [row, scope] = await Promise.all([findAttendanceById(id), getUserScope(session)]);
  if (!row) return null;
  if (!isWithinScope(scope, row.userId)) return null;
  return toSummary(row);
}

export async function getTeamDailyView(
  date: Date,
  session: ScopeSession,
): Promise<AttendanceReportSummary[]> {
  const scope = await getUserScope(session);
  const userIds = scopeUserIds(scope);
  const rows = await findAttendanceForDate(date, userIds);
  return rows.map(toSummary);
}
