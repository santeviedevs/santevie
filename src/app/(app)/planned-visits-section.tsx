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
import { formatDate, formatDateRange } from "@/lib/format-date";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { DateRange } from "@/lib/week";
import type { HomeRoutes, RouteGroupSummary } from "@/server/services/route-service";

type Dict = Dictionary["routesPage"];

function detailsHref(route: RouteGroupSummary): string {
  return `/visits#route-${route.id}`;
}

function period(route: RouteGroupSummary): string {
  return route.startDate && route.endDate ? formatDateRange(route.startDate, route.endDate) : "—";
}

function contactsAndCenters(route: RouteGroupSummary, dict: Dict): string {
  const contacts = route.items.reduce((sum, item) => sum + item.contacts.length, 0);
  return `${route.items.length} ${dict.itemsCountSuffix} · ${contacts} ${dict.contactsCountSuffix}`;
}

// A compact Route / Period / Contacts·Centers table — no status column or
// badges here by design (Planned Visits is a presentation view only; status
// is still derived and used elsewhere, e.g. the Add/Assign Routes lists).
function RouteTable({ routes, dict }: { routes: RouteGroupSummary[]; dict: Dict }) {
  return (
    <>
      <div className="hidden min-w-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{dict.colRoute}</TableHead>
              <TableHead>{dict.colPeriod}</TableHead>
              <TableHead>{dict.colCentersContacts}</TableHead>
              <TableHead aria-hidden className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {routes.map((route) => (
              <ClickableTableRow key={route.id} href={detailsHref(route)}>
                <TableCell>
                  <Link
                    href={detailsHref(route)}
                    className="rounded-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
                  >
                    {route.code}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap">{period(route)}</TableCell>
                <TableCell>{contactsAndCenters(route, dict)}</TableCell>
                <TableCell aria-hidden>
                  <ChevronRight className="size-4 text-muted-foreground" />
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
              href={detailsHref(route)}
              className="flex items-center justify-between gap-2 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
            >
              <dl className="grid min-w-0 grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="sr-only">{dict.colRoute}</dt>
                <dd className="col-span-2 font-medium">{route.code}</dd>
                <dt className="text-muted-foreground">{dict.colPeriod}</dt>
                <dd>{period(route)}</dd>
                <dt className="text-muted-foreground">{dict.colCentersContacts}</dt>
                <dd>{contactsAndCenters(route, dict)}</dd>
              </dl>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function WeekSection({
  heading,
  range,
  routes,
  emptyLabel,
  dict,
}: {
  heading: string;
  range: DateRange;
  routes: RouteGroupSummary[];
  emptyLabel: string;
  dict: Dict;
}) {
  return (
    <section className="flex flex-col gap-2" aria-label={heading}>
      <h3 className="flex flex-wrap items-baseline gap-2 text-sm font-medium">
        {heading}
        <span className="text-xs font-normal text-muted-foreground">
          {formatDate(range.start)} – {formatDate(range.end)}
        </span>
      </h3>
      {routes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <RouteTable routes={routes} dict={dict} />
      )}
    </section>
  );
}

// Home's Planned Visits: the signed-in user's own assignments, as two
// stacked sections — This Week and Upcoming Week. A route overlapping both
// weeks is one assignment shown in both, never split or duplicated. Each row
// opens the matching assignment on Visits (the only place a visitor's own
// routes have a detail view), scrolled straight to it.
export function PlannedVisitsSection({ routes, dict }: { routes: HomeRoutes; dict: Dict }) {
  const nothing = routes.thisWeek.routes.length === 0 && routes.upcomingWeek.routes.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">{dict.plannedVisitsHeading}</h2>
          <p className="text-xs text-muted-foreground">{dict.plannedVisitsHelp}</p>
        </div>
        <Button render={<Link href="/visits" />} variant="outline" size="sm">
          {dict.openVisits}
        </Button>
      </div>

      {nothing ? (
        <p className="text-sm text-muted-foreground">{dict.noRoutesThisWeekOrNext}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <WeekSection
            heading={dict.thisWeekHeading}
            range={routes.thisWeek.range}
            routes={routes.thisWeek.routes}
            emptyLabel={dict.noRoutesThisWeek}
            dict={dict}
          />
          <WeekSection
            heading={dict.upcomingWeekHeading}
            range={routes.upcomingWeek.range}
            routes={routes.upcomingWeek.routes}
            emptyLabel={dict.noRoutesUpcomingWeek}
            dict={dict}
          />
        </div>
      )}
    </div>
  );
}
