import Link from "next/link";

import type { Dictionary } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";

// Two separate routes, same Link-based pill bar pattern as
// calendar/calendar-tabs.tsx. Only shown to viewers who hold
// routes:assign-team — the whole Routes section is closed to Delegates.
export function RouteTabs({
  active,
  dict,
}: {
  active: "route" | "assign";
  dict: Dictionary["routesPage"];
}) {
  const tabs = [
    { key: "route" as const, href: "/routes/plan", label: dict.tabPlanRoutes },
    { key: "assign" as const, href: "/routes/assign", label: dict.tabAssignRoutes },
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
