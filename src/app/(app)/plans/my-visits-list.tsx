"use client";

import { CalendarDays, Check, User, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import type { Dictionary } from "@/lib/i18n/dictionary";

import {
  cancelPlanItemAction,
  completePlanItemAction,
  type PlanFormState,
  reorderPlanItemsAction,
} from "./actions";

type PlanItem = {
  id: string;
  sequence: number;
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "MISSED";
  client: { id: string; name: string; code: string };
};
type PlanGroup = {
  id: string;
  date: string | null;
  createdByName: string | null;
  items: PlanItem[];
};

const STATUS_VARIANT = {
  PENDING: "secondary",
  COMPLETED: "default",
  CANCELLED: "outline",
  MISSED: "destructive",
} as const;

// My Visits — purely respond. No add, no remove: content changes only
// happen on Plan Visits, even for a self-planned day. Each group here is
// one Plan assigned to the viewer; reorder, complete and cancel are all
// scoped to a single plan's items at a time.
export function MyVisitsList({
  plans,
  dict,
}: {
  plans: PlanGroup[];
  dict: Dictionary["plansPage"];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function move(planId: string, items: PlanItem[], index: number, direction: -1 | 1) {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];

    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("planId", planId);
      next.forEach((item) => formData.append("orderedPlanItemIds", item.id));
      const result: PlanFormState = await reorderPlanItemsAction({ error: null }, formData);
      if (result.error) setError(result.error);
    });
  }

  function complete(planItemId: string) {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("planItemId", planItemId);
      const result: PlanFormState = await completePlanItemAction({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(dict.visitCompleted);
    });
  }

  function cancel(planItemId: string) {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("planItemId", planItemId);
      const result: PlanFormState = await cancelPlanItemAction({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(dict.visitCancelled);
    });
  }

  if (plans.length === 0) {
    return <p className="text-sm text-muted-foreground">{dict.noPlansYet}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {plans.map((plan) => (
        <div key={plan.id} className="flex flex-col gap-2 rounded-md border border-border p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
              {plan.date ? formatDate(new Date(plan.date)) : dict.noDateYet}
            </h3>
            {plan.createdByName ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="size-4" aria-hidden />
                {dict.assignedByPrefix} {plan.createdByName}
              </span>
            ) : null}
          </div>

          {plan.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{dict.noClientsYet}</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {plan.items.map((item, index) => {
                const actionable = item.status === "PENDING" || item.status === "MISSED";
                return (
                  <li
                    key={item.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-2 rounded-md border border-border px-3 py-3 sm:gap-x-3"
                  >
                    <span className="col-start-1 row-start-1 font-semibold text-muted-foreground">
                      {index + 1}.
                    </span>
                    <span className="col-span-2 col-start-2 row-start-1 min-w-0 break-words font-medium">
                      {item.client.name} ({item.client.code})
                    </span>
                    <Badge
                      variant={STATUS_VARIANT[item.status]}
                      className="col-start-2 row-start-2 justify-self-start"
                    >
                      {item.status}
                    </Badge>
                    <div className="col-start-3 row-start-2 flex items-center justify-end gap-1.5 sm:gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="max-sm:w-8 max-sm:px-0"
                        disabled={isPending || index === 0}
                        onClick={() => move(plan.id, plan.items, index, -1)}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="max-sm:w-8 max-sm:px-0"
                        disabled={isPending || index === plan.items.length - 1}
                        onClick={() => move(plan.id, plan.items, index, 1)}
                      >
                        ↓
                      </Button>
                      {actionable ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            className="max-sm:w-8 max-sm:px-0"
                            title={dict.markComplete}
                            disabled={isPending}
                            onClick={() => complete(item.id)}
                          >
                            <Check className="sm:hidden" aria-hidden />
                            <span className="max-sm:sr-only">{dict.markComplete}</span>
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="max-sm:w-8 max-sm:px-0"
                            title={dict.markCancelled}
                            disabled={isPending}
                            onClick={() => cancel(item.id)}
                          >
                            <X className="sm:hidden" aria-hidden />
                            <span className="max-sm:sr-only">{dict.markCancelled}</span>
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      ))}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
