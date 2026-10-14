import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format-date";
import type { Dictionary } from "@/lib/i18n/dictionary";

type FollowUp = {
  id: string;
  dueDate: Date;
  participant: { id: string; name: string } | null;
  activity: {
    name: string;
    location: string | null;
    type: { id: string; code: string; name: string };
    center: { name: string } | null;
    territory: { code: string } | null;
  };
};

// Same "where" fallback chain as activities/follow-ups/follow-up-table.tsx
// — RTM, CME and Nurse Conference use a free-text venue instead of a
// center/territory, and Necessity-Driven has neither.
function whereLabel(activity: FollowUp["activity"]): string | null {
  return activity.center?.name ?? activity.territory?.code ?? activity.location ?? null;
}

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
// cards — the Add/Assign Routes row pattern. "Mark done" opens the
// follow-up's own detail/completion screen (same as the full My Follow-Ups
// widget) rather than completing in place, since completion now captures
// structured outcome data (prescription progress, business value, product
// availability — see completeFollowUpSchema) that a one-click action here
// has no way to collect.
export function HomeFollowUpsList({
  pending,
  today,
  dict,
}: {
  pending: FollowUp[];
  today: Date;
  dict: Dictionary["activitiesPage"];
}) {
  if (pending.length === 0) {
    return <p className="text-sm text-muted-foreground">{dict.noFollowUps}</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border border-y border-border">
      {pending.map((followUp) => {
        const status = dueDateStatus(followUp.dueDate, today);
        return (
          <li key={followUp.id}>
            <Link
              href={`/activities/follow-ups/${followUp.id}`}
              className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-muted/50"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  {status === "overdue" ? (
                    <Badge variant="destructive">{dict.overdue}</Badge>
                  ) : status === "dueToday" ? (
                    <Badge variant="secondary">{dict.dueToday}</Badge>
                  ) : null}
                  <span className="text-sm font-medium">{followUp.activity.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {followUp.activity.type.name}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {[
                    whereLabel(followUp.activity),
                    followUp.participant?.name,
                    formatDate(followUp.dueDate),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
                {dict.markDone}
                <ChevronRight className="size-4" aria-hidden />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
