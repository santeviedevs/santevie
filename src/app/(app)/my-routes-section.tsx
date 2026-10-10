import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateRange } from "@/lib/format-date";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { DateRange } from "@/lib/week";
import type { HomeRoutes, RouteGroupSummary } from "@/server/services/route-service";

import { ROUTE_STATUS_VARIANT, statusLabel } from "./routes/route-status";

function RouteRow({ route, dict }: { route: RouteGroupSummary; dict: Dictionary["routesPage"] }) {
  const contacts = route.items.reduce((sum, item) => sum + item.contacts.length, 0);

  return (
    <li className="flex flex-col gap-1.5 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{route.code}</span>
          <Badge variant={ROUTE_STATUS_VARIANT[route.status]}>
            {statusLabel(route.status, dict)}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {route.startDate && route.endDate ? formatDateRange(route.startDate, route.endDate) : ""}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {route.items.length} {dict.itemsCountSuffix} · {contacts} {dict.contactsCountSuffix}
      </p>
      {/* The whole route, every time — a route spanning both weeks lists the
          same centers and contacts in each section. */}
      <ul className="flex flex-col gap-0.5 text-sm">
        {route.items.map((item) => (
          <li key={item.id} className="break-words">
            {item.center.name}
            {item.contacts.length > 0 ? (
              <span className="text-xs text-muted-foreground">
                {" "}
                — {item.contacts.map((contact) => contact.name).join(", ")}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </li>
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
  dict: Dictionary["routesPage"];
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
        <ul className="flex flex-col gap-2">
          {routes.map((route) => (
            <RouteRow key={route.id} route={route} dict={dict} />
          ))}
        </ul>
      )}
    </section>
  );
}

// Home's "My Routes": the signed-in user's own assignments, as two stacked
// sections — This Week and Upcoming Week. A route overlapping both weeks is
// one assignment shown in both, never split or duplicated.
export function MyRoutesSection({
  routes,
  dict,
}: {
  routes: HomeRoutes;
  dict: Dictionary["routesPage"];
}) {
  const nothing = routes.thisWeek.routes.length === 0 && routes.upcomingWeek.routes.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{dict.myRoutesHeading}</h2>
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
