import Link from "next/link";

import type { Dictionary } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";

// Three separate routes, same Link-based pill bar pattern as
// calendar/calendar-tabs.tsx. Only shown to viewers who hold
// plans:assign-team — a DELEGATE never sees this, just My Visits directly.
export function PlanTabs({
  active,
  dict,
}: {
  active: "visits" | "assign" | "my-visits";
  dict: Dictionary["plansPage"];
}) {
  const tabs = [
    { key: "visits" as const, href: "/plans/visits", label: dict.tabPlanVisits },
    { key: "assign" as const, href: "/plans/assign", label: dict.tabAssignment },
    { key: "my-visits" as const, href: "/plans", label: dict.tabMyVisits },
  ];

  return (
    <div className="inline-flex w-fit gap-1 rounded-lg bg-muted p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            tab.key === active
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
