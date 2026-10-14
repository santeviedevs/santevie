"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { type ActivityFormState, completeFollowUpAction } from "./activities/actions";

type FollowUp = {
  id: string;
  dueDate: Date;
  activity: {
    type: { id: string; code: string; name: string };
    center: { name: string } | null;
    territory: { code: string } | null;
  };
};

// The due-date comparison a follow-up is shown against: calendar day only,
// same convention as lib/week.ts (a calendar date at UTC midnight,
// interpreted in Africa/Kinshasa). This intentionally diverges from
// follow-up-service.ts's `overdue` (a raw dueDate < asOf timestamp compare,
// which already counts a same-day follow-up as overdue from midnight on) —
// that calculation is left untouched; only this presentation layer tells
// "due today" apart from "overdue" by comparing whole days.
function dueDateStatus(dueDate: Date, today: Date): "overdue" | "dueToday" | "upcoming" {
  const day = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const todayMs = today.getTime();
  if (day < todayMs) return "overdue";
  if (day === todayMs) return "dueToday";
  return "upcoming";
}

// Home's Follow-ups: compact rows with subtle dividers, no individual
// cards — the Add/Assign Routes row pattern. Mark Done reuses the same
// server action and ownership checks as the full My Follow-Ups widget.
export function HomeFollowUpsList({
  pending,
  today,
  dict,
}: {
  pending: FollowUp[];
  today: Date;
  dict: Dictionary["activitiesPage"];
}) {
  const [isPending, startTransition] = useTransition();

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
    <ul className="flex flex-col divide-y divide-border border-y border-border">
      {pending.map((followUp) => {
        const status = dueDateStatus(followUp.dueDate, today);
        return (
          <li key={followUp.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {status === "overdue" ? (
                <Badge variant="destructive">{dict.overdue}</Badge>
              ) : status === "dueToday" ? (
                <Badge variant="secondary">{dict.dueToday}</Badge>
              ) : null}
              <span className="text-sm">
                {followUp.activity.center?.name ?? followUp.activity.territory?.code ?? "—"} —{" "}
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
        );
      })}
    </ul>
  );
}
