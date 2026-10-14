import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { ClickableTableRow } from "@/components/clickable-table-row";
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
import type { Dictionary } from "@/lib/i18n/dictionary";

import { ActivityStatusButtons } from "../activity-status-buttons";
import { AddFollowUpButton } from "../add-follow-up-button";

type Dict = Dictionary["activitiesPage"];

export type MyActivityRow = {
  assignmentId: string;
  activityId: string;
  activityName: string;
  type: { id: string; code: string; name: string };
  status: string;
  scheduledDate: string;
  executionRecorded: boolean;
};

function detailHref(row: MyActivityRow): string {
  return `/activities/my/${row.activityId}`;
}

function Actions({ row, dict }: { row: MyActivityRow; dict: Dict }) {
  if (row.status !== "PLANNED") return null;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        render={<Link href={`/activities/my/execute/${row.assignmentId}`} />}
        variant="outline"
        size="sm"
      >
        {dict.recordResultsAction}
      </Button>
      <AddFollowUpButton assignmentId={row.assignmentId} dict={dict} />
      <ActivityStatusButtons
        assignmentId={row.assignmentId}
        executionRecorded={row.executionRecorded}
        dict={dict}
      />
    </div>
  );
}

// My Activities table: one row per assignment the viewer holds. A row opens
// the activity's read-only detail view; the row's own quick actions (Add
// follow-up / Mark done / Cancel), shown only while still PLANNED, are the
// only way to act here — nested buttons never trigger the row's own
// navigation (see ClickableTableRow).
export function MyActivityTable({
  rows,
  dict,
  emptyLabel,
}: {
  rows: MyActivityRow[];
  dict: Dict;
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <>
      <div className="hidden min-w-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{dict.colActivity}</TableHead>
              <TableHead>{dict.colType}</TableHead>
              <TableHead>{dict.colScheduledDate}</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <ClickableTableRow key={row.assignmentId} href={detailHref(row)}>
                <TableCell className="font-medium">
                  <Link
                    href={detailHref(row)}
                    className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
                  >
                    {row.activityName}
                  </Link>
                </TableCell>
                <TableCell>{row.type.name}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatDate(new Date(row.scheduledDate))}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Actions row={row} dict={dict} />
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </div>
                </TableCell>
              </ClickableTableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col divide-y divide-border border-y border-border md:hidden">
        {rows.map((row) => (
          <li key={row.assignmentId} className="flex flex-col gap-2 py-3">
            <Link href={detailHref(row)} className="flex items-center justify-between gap-2">
              <span className="font-medium">{row.activityName}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{dict.colType}</dt>
              <dd>{row.type.name}</dd>
              <dt className="text-muted-foreground">{dict.colScheduledDate}</dt>
              <dd>{formatDate(new Date(row.scheduledDate))}</dd>
            </dl>
            <Actions row={row} dict={dict} />
          </li>
        ))}
      </ul>
    </>
  );
}
