"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { type ActivityFormState, completeFollowUpAction } from "./actions";

type FollowUp = {
  id: string;
  dueDate: Date;
  activity: { type: string; client: { name: string } | null; territory: { code: string } | null };
};

export function FollowUpsWidget({
  pending,
  overdue,
  dict,
}: {
  pending: FollowUp[];
  overdue: FollowUp[];
  dict: Dictionary["activitiesPage"];
}) {
  const [isPending, startTransition] = useTransition();
  const overdueIds = new Set(overdue.map((f) => f.id));

  function complete(id: string) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", id);
      const result: ActivityFormState = await completeFollowUpAction({ error: null }, formData);
      if (!result.error) toast.success(dict.followUpCompleted);
    });
  }

  if (pending.length === 0) {
    return <p className="text-sm text-muted-foreground">{dict.noFollowUps}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {pending.map((followUp) => (
        <li
          key={followUp.id}
          className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
        >
          <div className="flex items-center gap-2">
            {overdueIds.has(followUp.id) ? (
              <Badge variant="destructive">{dict.overdue}</Badge>
            ) : null}
            <span className="text-sm">
              {followUp.activity.client?.name ?? followUp.activity.territory?.code ?? "—"} —{" "}
              {formatDate(followUp.dueDate)}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => complete(followUp.id)}
          >
            {dict.markDone}
          </Button>
        </li>
      ))}
    </ul>
  );
}
