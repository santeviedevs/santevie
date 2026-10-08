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
  items: PlanItem[];
};

// Assignment list — summary only, same list+action pattern as Plan Visits.
// Who a plan belongs to and when is never decided here; "Assign"/
// "Reassign" navigates to the dedicated /plans/assign/[planId] page, which
// is the only place that actually writes.
export function AssignmentList({
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
        const hasCompleted = plan.items.some((item) => item.status === "COMPLETED");
        const hasActionable = plan.items.some(
          (item) => item.status === "PENDING" || item.status === "MISSED",
        );
        const reassignBlocked = hasCompleted && plan.visitorName !== null;
        const buttonLabel = reassignBlocked
          ? hasActionable
            ? dict.manageAssignmentAction
            : dict.viewAction
          : plan.visitorName
            ? dict.reassignAction
            : dict.assignAction;

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
              <Badge variant="secondary" className="w-fit">
                {plan.items.length} {dict.itemsCountSuffix}
              </Badge>
              {plan.items.length > 0 ? (
                <div className="flex flex-col text-xs text-muted-foreground">
                  {plan.items.map((item) => (
                    <span key={item.id}>
                      {item.client.name} ({item.client.code})
                    </span>
                  ))}
                </div>
              ) : null}
              {reassignBlocked ? (
                <p className="text-xs text-muted-foreground">{dict.hasCompletedHint}</p>
              ) : null}
            </div>

            <Button render={<Link href={`/plans/assign/${plan.id}`} />} variant="outline" size="sm">
              {buttonLabel}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
