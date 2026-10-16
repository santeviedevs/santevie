import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { ClickableTableRow } from "@/components/clickable-table-row";
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
import type { Dictionary } from "@/lib/i18n/dictionary";

import { assignmentStatusLabel, assignmentStatusVariant } from "../../activity-assignment-status";

type Dict = Dictionary["activitiesPage"];

export type TeamActivityRow = {
  id: string;
  status: string;
  scheduledDate: string;
  executionRecorded: boolean;
  user: { id: string; name: string };
  activity: { id: string; name: string; type: { id: string; code: string; name: string } };
};

function resultsHref(row: TeamActivityRow): string {
  return `/activities/my/execute/${row.id}`;
}

// Team Activities: one row per assignment across the viewer's downstream
// team (ADMIN: everyone) — same scope as the Assignment table, but read-only
// and reached by anyone holding activities:view-team, Supervisors included.
// A row only links through to the results view once something has actually
// been recorded; a still-PLANNED assignment has nothing to show yet.
export function TeamActivityTable({
  rows,
  dict,
  emptyLabel,
}: {
  rows: TeamActivityRow[];
  dict: Dict;
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-border p-4 text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <>
      <div className="hidden min-w-0 rounded-md border border-border p-2 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{dict.colActivity}</TableHead>
              <TableHead>{dict.colType}</TableHead>
              <TableHead>{dict.colAssignedTo}</TableHead>
              <TableHead>{dict.colScheduledDate}</TableHead>
              <TableHead>{dict.colStatus}</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const href = row.executionRecorded ? resultsHref(row) : null;
              const cells = (
                <>
                  <TableCell className="font-medium">
                    {href ? (
                      <Link
                        href={href}
                        className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
                      >
                        {row.activity.name}
                      </Link>
                    ) : (
                      row.activity.name
                    )}
                  </TableCell>
                  <TableCell>{row.activity.type.name}</TableCell>
                  <TableCell>{row.user.name}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(new Date(row.scheduledDate))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={assignmentStatusVariant(row.status)}>
                      {assignmentStatusLabel(row.status, dict)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {href ? (
                      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                        {dict.viewResultsAction}
                        <ChevronRight className="size-4 shrink-0" aria-hidden />
                      </span>
                    ) : null}
                  </TableCell>
                </>
              );
              return href ? (
                <ClickableTableRow key={row.id} href={href}>
                  {cells}
                </ClickableTableRow>
              ) : (
                <TableRow key={row.id}>{cells}</TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => {
          const href = row.executionRecorded ? resultsHref(row) : null;
          const content = (
            <>
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium">{row.activity.name}</span>
                <Badge variant={assignmentStatusVariant(row.status)}>
                  {assignmentStatusLabel(row.status, dict)}
                </Badge>
              </span>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">{dict.colType}</dt>
                <dd>{row.activity.type.name}</dd>
                <dt className="text-muted-foreground">{dict.colAssignedTo}</dt>
                <dd>{row.user.name}</dd>
                <dt className="text-muted-foreground">{dict.colScheduledDate}</dt>
                <dd>{formatDate(new Date(row.scheduledDate))}</dd>
              </dl>
            </>
          );
          return (
            <li key={row.id}>
              {href ? (
                <Link
                  href={href}
                  className="flex flex-col gap-2 rounded-md border border-border p-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {content}
                </Link>
              ) : (
                <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
