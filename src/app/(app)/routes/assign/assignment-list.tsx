import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import type { Dictionary } from "@/lib/i18n/dictionary";

type RouteItem = {
  id: string;
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "MISSED";
  center: { name: string; code: string };
};
type RouteGroup = {
  id: string;
  date: string | null;
  visitorName: string | null;
  items: RouteItem[];
};

// Assignment list — summary only, same list+action pattern as Plan Routes.
// Who a route belongs to and when is never decided here; "Assign"/
// "Reassign" navigates to the dedicated /routes/assign/[routeId] page, which
// is the only place that actually writes.
export function AssignmentList({
  routes,
  dict,
}: {
  routes: RouteGroup[];
  dict: Dictionary["routesPage"];
}) {
  if (routes.length === 0) {
    return <p className="text-sm text-muted-foreground">{dict.noRoutesYet}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {routes.map((route) => {
        const hasCompleted = route.items.some((item) => item.status === "COMPLETED");
        const hasActionable = route.items.some(
          (item) => item.status === "PENDING" || item.status === "MISSED",
        );
        const reassignBlocked = hasCompleted && route.visitorName !== null;
        const buttonLabel = reassignBlocked
          ? hasActionable
            ? dict.manageAssignmentAction
            : dict.viewAction
          : route.visitorName
            ? dict.reassignAction
            : dict.assignAction;

        return (
          <div
            key={route.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4"
          >
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold">
                {route.visitorName ?? dict.unassignedLabel}
                {route.date ? ` — ${formatDate(new Date(route.date))}` : ` (${dict.noDateYet})`}
              </h3>
              <Badge variant="secondary" className="w-fit">
                {route.items.length} {dict.itemsCountSuffix}
              </Badge>
              {route.items.length > 0 ? (
                <div className="flex flex-col text-xs text-muted-foreground">
                  {route.items.map((item) => (
                    <span key={item.id}>
                      {item.center.name} ({item.center.code})
                    </span>
                  ))}
                </div>
              ) : null}
              {reassignBlocked ? (
                <p className="text-xs text-muted-foreground">{dict.hasCompletedHint}</p>
              ) : null}
            </div>

            <Button
              render={<Link href={`/routes/assign/${route.id}`} />}
              variant="outline"
              size="sm"
            >
              {buttonLabel}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
