import Link from "next/link";

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
import type { RouteStatus } from "@/lib/schemas/route";
import type { RouteGroupSummary } from "@/server/services/route-service";

import { ClickableRow } from "./clickable-row";

const STATUS_VARIANT = {
  UNASSIGNED: "outline",
  ASSIGNED: "secondary",
  IN_PROGRESS: "default",
  MISSED: "destructive",
  COMPLETED: "default",
  CANCELLED: "outline",
} as const satisfies Record<RouteStatus, string>;

export function statusLabel(status: RouteStatus, dict: Dictionary["routesPage"]): string {
  switch (status) {
    case "UNASSIGNED":
      return dict.statusUnassigned;
    case "ASSIGNED":
      return dict.statusAssigned;
    case "IN_PROGRESS":
      return dict.statusInProgress;
    case "MISSED":
      return dict.statusMissed;
    case "COMPLETED":
      return dict.statusCompleted;
    case "CANCELLED":
      return dict.statusCancelled;
  }
}

// Where a row leads: the route's Manage page — the existing detail view, where
// every permitted assignment action (reassign, cancel) lives and is guarded
// again on the server. There are no per-row buttons.
function detailHref(route: RouteGroupSummary): string {
  return `/routes/assign/${route.id}`;
}

function summary(route: RouteGroupSummary, dict: Dictionary["routesPage"]): string {
  const contacts = route.items.reduce((sum, item) => sum + item.contacts.length, 0);
  return `${route.items.length} ${dict.itemsCountSuffix} · ${contacts} ${dict.contactsCountSuffix}`;
}

function range(route: RouteGroupSummary): string {
  return route.startDate && route.endDate ? formatDateRange(route.startDate, route.endDate) : "—";
}

// The routes table: a real table from md up, stacked rows below it so a phone
// never has to scroll sideways through seven columns.
export function RoutesTable({
  routes,
  dict,
  emptyLabel,
}: {
  routes: RouteGroupSummary[];
  dict: Dictionary["routesPage"];
  emptyLabel: string;
}) {
  if (routes.length === 0) {
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
              <TableHead>{dict.colRoute}</TableHead>
              <TableHead>{dict.colCentersContacts}</TableHead>
              <TableHead>{dict.colAssignedTo}</TableHead>
              <TableHead>{dict.colDateRange}</TableHead>
              <TableHead>{dict.colStatus}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {routes.map((route) => (
              <ClickableRow key={route.id} href={detailHref(route)}>
                <TableCell className="font-medium">
                  <Link
                    href={detailHref(route)}
                    className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
                  >
                    {route.code}
                  </Link>
                </TableCell>
                <TableCell>{summary(route, dict)}</TableCell>
                <TableCell>{route.visitorName ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{range(route)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[route.status]}>
                    {statusLabel(route.status, dict)}
                  </Badge>
                </TableCell>
              </ClickableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {routes.map((route) => (
          <li key={route.id}>
            <Link
              href={detailHref(route)}
              className="flex flex-col gap-2 rounded-md border border-border p-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium">{route.code}</span>
                <Badge variant={STATUS_VARIANT[route.status]}>
                  {statusLabel(route.status, dict)}
                </Badge>
              </span>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">{dict.colCentersContacts}</dt>
                <dd>{summary(route, dict)}</dd>
                <dt className="text-muted-foreground">{dict.colAssignedTo}</dt>
                <dd>{route.visitorName ?? "—"}</dd>
                <dt className="text-muted-foreground">{dict.colDateRange}</dt>
                <dd>{range(route)}</dd>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
