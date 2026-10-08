"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { type ActivityFormState, updateActivityStatusAction } from "./actions";

// The assignee's way to respond: mark a planned activity done or cancel it.
// Only rendered for a PLANNED activity the viewer owns (or, for a manager,
// manages) — the server re-checks both.
export function ActivityStatusButtons({
  activityId,
  dict,
}: {
  activityId: string;
  dict: Dictionary["activitiesPage"];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update(status: "DONE" | "CANCELLED") {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", activityId);
      formData.set("status", status);
      const result: ActivityFormState = await updateActivityStatusAction({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(dict.activityUpdated);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={isPending} onClick={() => update("DONE")}>
          {dict.markActivityDone}
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isPending}
          onClick={() => update("CANCELLED")}
        >
          {dict.markActivityCancelled}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
