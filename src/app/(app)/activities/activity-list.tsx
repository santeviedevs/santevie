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

import { assignmentStatusVariant } from "./activity-assignment-status";

type Dict = Dictionary["activitiesPage"];

export type ActivityListRow = {
  id: string;
  name: string;
  type: { id: string; code: string; name: string };
  createdAt: string;
  assignments: { id: string; status: string; user: { id: string; name: string } }[];
  createdByName: string | null;
};

function detailHref(activity: ActivityListRow): string {
  return `/activities/${activity.id}`;
}

function AssigneeBadges({ row, dict }: { row: ActivityListRow; dict: Dict }) {
  if (row.assignments.length === 0) {
    return <span className="text-muted-foreground">{dict.unassignedLabel}</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {row.assignments.map((assignment) => (
        <Badge key={assignment.id} variant={assignmentStatusVariant(assignment.status)}>
          {assignment.user.name}
        </Badge>
      ))}
    </div>
  );
}

// The Activity List: a plain table with dividers, same pattern as the
// redesigned Add Routes list. A row opens the activity's edit page — there
// are no inline respond actions here; those live only on My Activities.
export function ActivityList({
  activities,
  dict,
  emptyLabel,
}: {
  activities: ActivityListRow[];
  dict: Dict;
  emptyLabel: string;
}) {
  if (activities.length === 0) {
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
              <TableHead>{dict.colAssignees}</TableHead>
              <TableHead>{dict.colCreatedBy}</TableHead>
              <TableHead>{dict.colCreatedOn}</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.map((activity) => (
              <ClickableTableRow key={activity.id} href={detailHref(activity)}>
                <TableCell className="font-medium">
                  <Link
                    href={detailHref(activity)}
                    className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
                  >
                    {activity.name}
                  </Link>
                </TableCell>
                <TableCell>{activity.type.name}</TableCell>
                <TableCell>
                  <AssigneeBadges row={activity} dict={dict} />
                </TableCell>
                <TableCell>{activity.createdByName ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatDate(new Date(activity.createdAt))}
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

      <ul className="flex flex-col divide-y divide-border border-y border-border md:hidden">
        {activities.map((activity) => (
          <li key={activity.id} className="flex flex-col gap-2 py-3">
            <Link href={detailHref(activity)} className="flex items-center justify-between gap-2">
              <span className="font-medium">{activity.name}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{dict.colType}</dt>
              <dd>{activity.type.name}</dd>
              <dt className="text-muted-foreground">{dict.colAssignees}</dt>
              <dd>
                <AssigneeBadges row={activity} dict={dict} />
              </dd>
              <dt className="text-muted-foreground">{dict.colCreatedBy}</dt>
              <dd>{activity.createdByName ?? "—"}</dd>
              <dt className="text-muted-foreground">{dict.colCreatedOn}</dt>
              <dd>{formatDate(new Date(activity.createdAt))}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
