import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import type { Dictionary } from "@/lib/i18n/dictionary";

type RouteItem = {
  id: string;
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "MISSED";
  center: { name: string; code: string };
  contacts: { id: string; name: string; status: string }[];
};
type RouteGroup = {
  id: string;
  date: string | null;
  visitorName: string | null;
  editable: boolean;
  items: RouteItem[];
};

const STATUS_VARIANT = {
  PENDING: "secondary",
  COMPLETED: "default",
  CANCELLED: "outline",
  MISSED: "destructive",
} as const;

// Plan Routes list — summary only, same list+Edit pattern as every other
// CRUD screen in this app (e.g. admin/centers). All content editing
// (add/remove/reorder, the Save-gated draft) happens on the dedicated
// /routes/plan/[routeId] page, not here.
export function RouteList({
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
        const counts = route.items.reduce<Record<string, number>>((acc, item) => {
          acc[item.status] = (acc[item.status] ?? 0) + 1;
          return acc;
        }, {});

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
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {route.items.length} {dict.itemsCountSuffix}
                </span>
                {Object.entries(counts).map(([status, count]) => (
                  <Badge
                    key={status}
                    variant={STATUS_VARIANT[status as keyof typeof STATUS_VARIANT]}
                  >
                    {count} {status}
                  </Badge>
                ))}
                {!route.editable ? (
                  <span className="text-xs text-muted-foreground">{dict.locked}</span>
                ) : null}
              </div>
              {route.items.length > 0 ? (
                <div className="flex flex-col text-xs text-muted-foreground">
                  {route.items.map((item) => (
                    <span key={item.id}>
                      {item.center.name} ({item.center.code})
                      {item.contacts.length > 0
                        ? ` — ${item.contacts.map((c) => c.name).join(", ")}`
                        : ""}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <Button render={<Link href={`/routes/plan/${route.id}`} />} variant="outline" size="sm">
              {route.editable ? dict.editAction : dict.viewAction}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
