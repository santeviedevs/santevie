"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { cancelRouteItemAction, type RouteFormState } from "../actions";

type RouteItem = {
  id: string;
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "MISSED";
  center: { name: string; code: string };
};

const STATUS_VARIANT = {
  PENDING: "secondary",
  COMPLETED: "default",
  CANCELLED: "outline",
  MISSED: "destructive",
} as const;

// A route whose date has already started — content is locked (no add,
// remove or reorder), but a still-pending/missed item can still be
// cancelled.
export function RouteLockedView({
  items,
  dict,
}: {
  items: RouteItem[];
  dict: Dictionary["routesPage"];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function cancelItem(routeItemId: string) {
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

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{dict.noCentersYet}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-2">
        {items.map((item, index) => {
          const cancellable = item.status === "PENDING" || item.status === "MISSED";
          return (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span>
                  {index + 1}. {item.center.name} ({item.center.code})
                </span>
                <Badge variant={STATUS_VARIANT[item.status]}>{item.status}</Badge>
              </div>
              {cancellable ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => cancelItem(item.id)}
                >
                  {dict.markCancelled}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ol>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
