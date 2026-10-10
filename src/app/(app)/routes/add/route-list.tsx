import { Building2, User } from "lucide-react";
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
import { formatDateRange } from "@/lib/format-date";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { RouteGroupSummary } from "@/server/services/route-service";

import { ROUTE_STATUS_VARIANT, statusLabel } from "../route-status";

type Dict = Dictionary["routesPage"];

function editHref(route: RouteGroupSummary): string {
  return `/routes/add/${route.id}`;
}

function contactCount(route: RouteGroupSummary): number {
  return route.items.reduce((sum, item) => sum + item.contacts.length, 0);
}

// "(1 completed · 3 pending)" — only the statuses that actually occur, so an
// untouched route reads "(4 pending)" and a finished one "(4 completed)".
function contactBreakdown(route: RouteGroupSummary, dict: Dict): string {
  const counts = { COMPLETED: 0, PENDING: 0, MISSED: 0, CANCELLED: 0 };
  for (const item of route.items) {
    for (const contact of item.contacts) counts[contact.status] += 1;
  }
  const parts = [
    counts.COMPLETED > 0 ? `${counts.COMPLETED} ${dict.contactStatusCompleted}` : null,
    counts.PENDING > 0 ? `${counts.PENDING} ${dict.contactStatusPending}` : null,
    counts.MISSED > 0 ? `${counts.MISSED} ${dict.contactStatusMissed}` : null,
    counts.CANCELLED > 0 ? `${counts.CANCELLED} ${dict.contactStatusCancelled}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? `(${parts.join(" · ")})` : "";
}

function period(route: RouteGroupSummary): string {
  return route.startDate && route.endDate ? formatDateRange(route.startDate, route.endDate) : "—";
}

function RouteCodeCell({ route, dict }: { route: RouteGroupSummary; dict: Dict }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={editHref(route)}
        className="rounded-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
      >
        {route.code}
      </Link>
      <Badge variant={ROUTE_STATUS_VARIANT[route.status]}>{statusLabel(route.status, dict)}</Badge>
    </div>
  );
}

// The Add Routes list: a plain table with dividers — the same pattern as the
// Assign Routes table — instead of a card per route. The whole row opens the
// route (its code is the real link, for keyboard and screen readers); there
// is no separate Edit button. From md up it is a table, below it stacked rows
// so a phone never scrolls sideways.
export function RouteList({ routes, dict }: { routes: RouteGroupSummary[]; dict: Dict }) {
  if (routes.length === 0) {
    return <p className="text-sm text-muted-foreground">{dict.noRoutesYet}</p>;
  }

  return (
    <>
      <div className="hidden min-w-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{dict.colRoute}</TableHead>
              <TableHead>{dict.colAssignedTo}</TableHead>
              <TableHead>{dict.colAssignmentPeriod}</TableHead>
              <TableHead>{dict.colCenters}</TableHead>
              <TableHead>{dict.colContacts}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {routes.map((route) => (
              <ClickableTableRow key={route.id} href={editHref(route)}>
                <TableCell>
                  <RouteCodeCell route={route} dict={dict} />
                </TableCell>
                <TableCell>
                  {route.visitorName ? (
                    <span className="flex items-center gap-1.5">
                      <User className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      {route.visitorName}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">{period(route)}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    {route.items.length} {dict.itemsCountSuffix}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span>
                      {contactCount(route)} {dict.contactsCountSuffix}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {contactBreakdown(route, dict)}
                    </span>
                  </div>
                </TableCell>
              </ClickableTableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col divide-y divide-border border-y border-border md:hidden">
        {routes.map((route) => (
          <li key={route.id}>
            <Link
              href={editHref(route)}
              className="flex flex-col gap-2 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{route.code}</span>
                <Badge variant={ROUTE_STATUS_VARIANT[route.status]}>
                  {statusLabel(route.status, dict)}
                </Badge>
              </span>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">{dict.colAssignedTo}</dt>
                <dd>{route.visitorName ?? "—"}</dd>
                <dt className="text-muted-foreground">{dict.colAssignmentPeriod}</dt>
                <dd>{period(route)}</dd>
                <dt className="text-muted-foreground">{dict.colCenters}</dt>
                <dd>
                  {route.items.length} {dict.itemsCountSuffix}
                </dd>
                <dt className="text-muted-foreground">{dict.colContacts}</dt>
                <dd>
                  {contactCount(route)} {dict.contactsCountSuffix}{" "}
                  <span className="text-xs text-muted-foreground">
                    {contactBreakdown(route, dict)}
                  </span>
                </dd>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
