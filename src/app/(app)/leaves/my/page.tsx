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
import { leaveFiltersSchema } from "@/lib/schemas/leave";
import { requirePermission } from "@/server/auth/require-permission";
import { listLeaveTypes } from "@/server/repositories/leave-type-repository";
import { listMyLeaves } from "@/server/services/leave-service";

import { LeaveFilters } from "../leave-filters";
import { LeaveDecisionActions } from "../team/leave-decision-actions";

// Every user's own leave history — always scoped to the session user, never
// any other id, regardless of what a query string might claim. User-scoped,
// so never statically cached (execution plan, section 4).
export const dynamic = "force-dynamic";

type MyLeavesPageProps = {
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

export default async function MyLeavesPage({ searchParams }: MyLeavesPageProps) {
  const session = await requirePermission("leave:view-own");

  const params = await searchParams;
  const filters = leaveFiltersSchema.parse({
    leaveTypeId: firstValue(params.leaveTypeId),
    status: firstValue(params.status),
    from: firstValue(params.from),
    to: firstValue(params.to),
    page: firstValue(params.page),
    pageSize: firstValue(params.pageSize),
  });

  const [{ items: leaves, total }, leaveTypes, dict] = await Promise.all([
    listMyLeaves(session.user.id, filters),
    listLeaveTypes(),
    getServerDictionary(),
  ]);
  const t = dict.leavesPage;
  // Admin has no one above them in the reporting hierarchy, so their own
  // leave is the one case decided from My Leaves rather than Team Leaves —
  // Team Leaves is downstream-only and never lists the viewer's own row.
  // See the self-request branch in leave-service.ts's decideLeave.
  const canSelfApprove = session.user.roleName === "ADMIN";

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t.myTitle}</h1>
        <Button render={<Link href="/leaves/my/new" />}>{t.applyLeave}</Button>
      </div>

      <LeaveFilters
        leaveTypes={leaveTypes.map((type) => ({ id: type.id, name: type.name }))}
        filters={filters}
        dict={t}
      />

      <div className="min-w-0 rounded-md border border-border p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columnType}</TableHead>
              <TableHead>{t.columnDates}</TableHead>
              <TableHead>{t.columnReason}</TableHead>
              <TableHead>{t.columnStatus}</TableHead>
              {canSelfApprove ? <TableHead>{t.columnActions}</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaves.map((leave) => (
              <TableRow key={leave.id}>
                <TableCell>{leave.leaveType.name}</TableCell>
                <TableCell>
                  {formatDate(leave.startDate)}
                  {leave.startDate.getTime() !== leave.endDate.getTime()
                    ? ` – ${formatDate(leave.endDate)}`
                    : ""}
                </TableCell>
                <TableCell>{leave.reason ?? "—"}</TableCell>
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
                {canSelfApprove ? (
                  <TableCell>
                    {leave.status === "PENDING" ? (
                      <LeaveDecisionActions leaveId={leave.id} dict={t} />
                    ) : null}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
            {leaves.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canSelfApprove ? 5 : 4}
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
