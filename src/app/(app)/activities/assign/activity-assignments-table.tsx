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

import { assignmentStatusLabel, assignmentStatusVariant } from "../activity-assignment-status";

type Dict = Dictionary["activitiesPage"];

export type ActivityAssignmentRow = {
  id: string;
  status: string;
  scheduledDate: string;
  user: { id: string; name: string };
  activity: { id: string; name: string; type: { id: string; code: string; name: string } };
};

function detailHref(assignment: ActivityAssignmentRow): string {
  return `/activities/assign/${assignment.id}`;
}

// The assignment table: a real table from md up, stacked rows below it, same
// pattern as RoutesTable. Each row is one assignment (not one activity) —
// the same activity can appear more than once, each time for a different
// assignee. A row opens that one assignment's Manage page, where reassign
// and cancel live, scoped to that assignment alone.
export function ActivityAssignmentsTable({
  assignments,
  dict,
  emptyLabel,
}: {
  assignments: ActivityAssignmentRow[];
  dict: Dict;
  emptyLabel: string;
}) {
  if (assignments.length === 0) {
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
            {assignments.map((assignment) => (
              <ClickableTableRow key={assignment.id} href={detailHref(assignment)}>
                <TableCell className="font-medium">
                  <Link
                    href={detailHref(assignment)}
                    className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
                  >
                    {assignment.activity.name}
                  </Link>
                </TableCell>
                <TableCell>{assignment.activity.type.name}</TableCell>
                <TableCell>{assignment.user.name}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatDate(new Date(assignment.scheduledDate))}
                </TableCell>
                <TableCell>
                  <Badge variant={assignmentStatusVariant(assignment.status)}>
                    {assignmentStatusLabel(assignment.status, dict)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <ChevronRight
                    className="ml-auto size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </TableCell>
              </ClickableTableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {assignments.map((assignment) => (
          <li key={assignment.id}>
            <Link
              href={detailHref(assignment)}
              className="flex flex-col gap-2 rounded-md border border-border p-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium">{assignment.activity.name}</span>
                <Badge variant={assignmentStatusVariant(assignment.status)}>
                  {assignmentStatusLabel(assignment.status, dict)}
                </Badge>
              </span>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">{dict.colType}</dt>
                <dd>{assignment.activity.type.name}</dd>
                <dt className="text-muted-foreground">{dict.colAssignedTo}</dt>
                <dd>{assignment.user.name}</dd>
                <dt className="text-muted-foreground">{dict.colScheduledDate}</dt>
                <dd>{formatDate(new Date(assignment.scheduledDate))}</dd>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
