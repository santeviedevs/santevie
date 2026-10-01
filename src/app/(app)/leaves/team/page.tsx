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
import { formatDate } from "@/lib/format-date";
import { getServerDictionary } from "@/lib/i18n/server";
import { totalPages } from "@/lib/pagination";
import { leaveFiltersSchema } from "@/lib/schemas/leave";
import { requirePermission } from "@/server/auth/require-permission";
import { listLeaveTypes } from "@/server/repositories/leave-type-repository";
import { getDownstreamUserIds, isWithinScope } from "@/server/scope";
import { listTeamLeaves } from "@/server/services/leave-service";
import { listActiveTerritoryOptions } from "@/server/services/territory-service";
import { listAllUsersInScope } from "@/server/services/user-service";

import { LeaveFilters } from "../leave-filters";
import { LeaveDecisionActions } from "./leave-decision-actions";

// Downstream requests only — every list query here routes through
// getDownstreamUserIds (src/server/scope.ts, S1-07's hierarchy resolution),
// the same helper team/page.tsx already uses. A missed hierarchy filter
// means one supervisor sees another team's data (execution plan, section
// 4), which is why the scope check is done server-side here, not just
// hidden in the UI.
export const dynamic = "force-dynamic";

type TeamLeavesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

const STATUS_LABEL_KEY = {
  PENDING: "statusPending",
  APPROVED: "statusApproved",
  REJECTED: "statusRejected",
} as const;

export default async function TeamLeavesPage({ searchParams }: TeamLeavesPageProps) {
  const session = await requirePermission("leave:view-team");

  const params = await searchParams;
  const filters = leaveFiltersSchema.parse({
    leaveTypeId: firstValue(params.leaveTypeId),
    status: firstValue(params.status),
    from: firstValue(params.from),
    to: firstValue(params.to),
    employeeId: firstValue(params.employeeId),
    territoryId: firstValue(params.territoryId),
    page: firstValue(params.page),
    pageSize: firstValue(params.pageSize),
  });

  const downstream = await getDownstreamUserIds(session.user.id);
  const scope = { kind: "ids", userIds: downstream } as const;

  const [{ items: leaves, total }, leaveTypes, employees, territories, dict] = await Promise.all([
    listTeamLeaves(downstream, filters),
    listLeaveTypes(),
    listAllUsersInScope(scope),
    listActiveTerritoryOptions(),
    getServerDictionary(),
  ]);
  const t = dict.leavesPage;

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{t.teamTitle}</h1>

      <LeaveFilters
        leaveTypes={leaveTypes.map((type) => ({ id: type.id, name: type.name }))}
        employees={employees.map((employee) => ({
          id: employee.id,
          name: employee.name,
          employeeCode: employee.employeeCode,
        }))}
        territories={territories.map((territory) => ({
          id: territory.id,
          code: territory.code,
          label: territory.label,
        }))}
        filters={filters}
        dict={t}
        territoryDict={dict.territory}
      />

      <div className="min-w-0 rounded-md border border-border p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columnEmployee}</TableHead>
              <TableHead>{t.columnType}</TableHead>
              <TableHead>{t.columnDates}</TableHead>
              <TableHead>{t.columnStatus}</TableHead>
              <TableHead>{t.columnActions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaves.map((leave) => (
              <TableRow key={leave.id}>
                <TableCell>
                  {leave.user.name} ({leave.user.employeeCode})
                </TableCell>
                <TableCell>{leave.leaveType.name}</TableCell>
                <TableCell>
                  {formatDate(leave.startDate)}
                  {leave.startDate.getTime() !== leave.endDate.getTime()
                    ? ` – ${formatDate(leave.endDate)}`
                    : ""}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      leave.status === "APPROVED"
                        ? "default"
                        : leave.status === "REJECTED"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {t[STATUS_LABEL_KEY[leave.status]]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {leave.status === "PENDING" && isWithinScope(scope, leave.user.id) ? (
                    <LeaveDecisionActions leaveId={leave.id} dict={t} />
                  ) : (
                    <span className="text-sm text-muted-foreground">{t.view}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {leaves.length === 0 ? (
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
