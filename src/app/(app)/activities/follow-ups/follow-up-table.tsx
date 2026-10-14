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

type Dict = Dictionary["activitiesPage"];

export type FollowUpTableRow = {
  id: string;
  status: string;
  dueDate: Date;
  ownerName: string;
  participant: { id: string; name: string } | null;
  activity: {
    name: string;
    location: string | null;
    type: { id: string; code: string; name: string };
    center: { name: string } | null;
    territory: { code: string } | null;
  };
};

// Center/territory alone isn't enough — RTM, CME and Nurse Conference use a
// free-text venue instead (Activity.location), and Necessity-Driven has
// neither. Same fallback chain used everywhere a follow-up's location is
// shown.
function whereLabel(activity: FollowUpTableRow["activity"]): string {
  return activity.center?.name ?? activity.territory?.code ?? activity.location ?? "—";
}

function detailHref(row: FollowUpTableRow, fromTeam: boolean): string {
  return `/activities/follow-ups/${row.id}${fromTeam ? "?from=team" : ""}`;
}

// Overdue only ever applies to a still-PENDING row — a DONE one isn't
// "overdue" in any actionable sense regardless of when it was completed.
function StatusBadge({
  row,
  overdueIds,
  dict,
}: {
  row: FollowUpTableRow;
  overdueIds: Set<string>;
  dict: Dict;
}) {
  if (row.status === "DONE") return <Badge variant="secondary">{dict.followUpStatusDone}</Badge>;
  if (overdueIds.has(row.id)) return <Badge variant="destructive">{dict.overdue}</Badge>;
  return <Badge variant="outline">{dict.followUpStatusPending}</Badge>;
}

// The My/Team Follow-Ups table: a plain table with dividers, same pattern
// as the Activity List. `showOwner` adds an Owner column and tags row links
// with `?from=team` so the detail page's Back button returns here instead
// of the default My Follow-Ups.
export function FollowUpTable({
  rows,
  overdueIds,
  dict,
  showOwner = false,
  emptyLabel,
}: {
  rows: FollowUpTableRow[];
  overdueIds: Set<string>;
  dict: Dict;
  showOwner?: boolean;
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
              {showOwner ? <TableHead>{dict.colOwner}</TableHead> : null}
              <TableHead>{dict.colWhere}</TableHead>
              <TableHead>{dict.participantLabel}</TableHead>
              <TableHead>{dict.dueDateColumn}</TableHead>
              <TableHead>{dict.colStatus}</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <ClickableTableRow key={row.id} href={detailHref(row, showOwner)}>
                <TableCell className="font-medium">
                  <Link
                    href={detailHref(row, showOwner)}
                    className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
                  >
                    {row.activity.name}
                  </Link>
                </TableCell>
                <TableCell>{row.activity.type.name}</TableCell>
                {showOwner ? <TableCell>{row.ownerName}</TableCell> : null}
                <TableCell>{whereLabel(row.activity)}</TableCell>
                <TableCell>{row.participant?.name ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(row.dueDate)}</TableCell>
                <TableCell>
                  <StatusBadge row={row} overdueIds={overdueIds} dict={dict} />
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
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-2 py-3">
            <Link
              href={detailHref(row, showOwner)}
              className="flex items-center justify-between gap-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <StatusBadge row={row} overdueIds={overdueIds} dict={dict} />
                <span className="font-medium">{row.activity.name}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{dict.colType}</dt>
              <dd>{row.activity.type.name}</dd>
              {showOwner ? (
                <>
                  <dt className="text-muted-foreground">{dict.colOwner}</dt>
                  <dd>{row.ownerName}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">{dict.colWhere}</dt>
              <dd>{whereLabel(row.activity)}</dd>
              {row.participant ? (
                <>
                  <dt className="text-muted-foreground">{dict.participantLabel}</dt>
                  <dd>{row.participant.name}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">{dict.dueDateColumn}</dt>
              <dd>{formatDate(row.dueDate)}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
