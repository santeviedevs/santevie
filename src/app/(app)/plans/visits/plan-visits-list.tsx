import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import type { Dictionary } from "@/lib/i18n/dictionary";

type PlanItem = {
  id: string;
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "MISSED";
  client: { name: string; code: string };
};
type PlanGroup = {
  id: string;
  date: string | null;
  visitorName: string | null;
  editable: boolean;
  items: PlanItem[];
};

const STATUS_VARIANT = {
  PENDING: "secondary",
  COMPLETED: "default",
  CANCELLED: "outline",
  MISSED: "destructive",
} as const;

// Plan Visits list — summary only, same list+Edit pattern as every other
// CRUD screen in this app (e.g. admin/clients). All content editing
// (add/remove/reorder, the Save-gated draft) happens on the dedicated
// /plans/visits/[planId] page, not here.
export function PlanVisitsList({
  plans,
  dict,
}: {
  plans: PlanGroup[];
  dict: Dictionary["plansPage"];
}) {
  if (plans.length === 0) {
    return <p className="text-sm text-muted-foreground">{dict.noPlansYet}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {plans.map((plan) => {
        const counts = plan.items.reduce<Record<string, number>>((acc, item) => {
          acc[item.status] = (acc[item.status] ?? 0) + 1;
          return acc;
        }, {});

        return (
          <div
            key={plan.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4"
          >
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold">
                {plan.visitorName ?? dict.unassignedLabel}
                {plan.date ? ` — ${formatDate(new Date(plan.date))}` : ` (${dict.noDateYet})`}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {plan.items.length} {dict.itemsCountSuffix}
                </span>
                {Object.entries(counts).map(([status, count]) => (
                  <Badge
                    key={status}
                    variant={STATUS_VARIANT[status as keyof typeof STATUS_VARIANT]}
                  >
                    {count} {status}
                  </Badge>
                ))}
                {!plan.editable ? (
                  <span className="text-xs text-muted-foreground">{dict.locked}</span>
                ) : null}
              </div>
              {plan.items.length > 0 ? (
                <div className="flex flex-col text-xs text-muted-foreground">
                  {plan.items.map((item) => (
                    <span key={item.id}>
                      {item.client.name} ({item.client.code})
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <Button render={<Link href={`/plans/visits/${plan.id}`} />} variant="outline" size="sm">
              {plan.editable ? dict.editAction : dict.viewAction}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
