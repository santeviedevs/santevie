"use client";

import { CalendarDays, Check, User, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import type { Dictionary } from "@/lib/i18n/dictionary";

import {
  cancelRouteItemAction,
  completeRouteItemAction,
  reorderRouteItemsAction,
  type RouteFormState,
} from "../routes/actions";

type RouteItem = {
  id: string;
  sequence: number;
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "MISSED";
  center: { id: string; name: string; code: string };
};
type RouteGroup = {
  id: string;
  date: string | null;
  createdByName: string | null;
  items: RouteItem[];
};

const STATUS_VARIANT = {
  PENDING: "secondary",
  COMPLETED: "default",
  CANCELLED: "outline",
  MISSED: "destructive",
} as const;

// Visits — purely respond. No add, no remove: content changes only
// happen on Plan Routes, even for a self-planned day. Each group here is
// one Route assigned to the viewer; reorder, complete and cancel are all
// scoped to a single route's items at a time.
export function MyVisitsList({
  routes,
  dict,
}: {
  routes: RouteGroup[];
  dict: Dictionary["routesPage"];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function move(routeId: string, items: RouteItem[], index: number, direction: -1 | 1) {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];

    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("routeId", routeId);
      next.forEach((item) => formData.append("orderedRouteItemIds", item.id));
      const result: RouteFormState = await reorderRouteItemsAction({ error: null }, formData);
      if (result.error) setError(result.error);
    });
  }

  function complete(routeItemId: string) {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("routeItemId", routeItemId);
      const result: RouteFormState = await completeRouteItemAction({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(dict.visitCompleted);
    });
  }

  function cancel(routeItemId: string) {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("routeItemId", routeItemId);
      const result: RouteFormState = await cancelRouteItemAction({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(dict.visitCancelled);
    });
  }

  if (routes.length === 0) {
    return <p className="text-sm text-muted-foreground">{dict.noRoutesYet}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {routes.map((route) => (
        <div key={route.id} className="flex flex-col gap-2 rounded-md border border-border p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
              {route.date ? formatDate(new Date(route.date)) : dict.noDateYet}
            </h3>
            {route.createdByName ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="size-4" aria-hidden />
                {dict.assignedByPrefix} {route.createdByName}
              </span>
            ) : null}
          </div>

          {route.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{dict.noCentersYet}</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {route.items.map((item, index) => {
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
                      {item.center.name} ({item.center.code})
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
                        onClick={() => move(route.id, route.items, index, -1)}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="max-sm:w-8 max-sm:px-0"
                        disabled={isPending || index === route.items.length - 1}
                        onClick={() => move(route.id, route.items, index, 1)}
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
