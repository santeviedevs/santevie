import Link from "next/link";

import type { Dictionary } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";

type ActivityTabKey = "list" | "assign" | "calendar" | "mine";

// Route-based pill bar, same pattern as calendar/calendar-tabs.tsx. A
// manager (activities:assign) gets the full set; everyone else sees only the
// activities assigned to them and the calendar of those same activities.
export function ActivityTabs({
  active,
  canAssign,
  dict,
}: {
  active: ActivityTabKey;
  canAssign: boolean;
  dict: Dictionary["activitiesPage"];
}) {
  const tabs: { key: ActivityTabKey; href: string; label: string }[] = canAssign
    ? [
        { key: "list", href: "/activities", label: dict.tabActivityList },
        { key: "assign", href: "/activities/assign", label: dict.tabAssignment },
        { key: "calendar", href: "/activities/calendar", label: dict.tabCalendar },
      ]
    : [
        { key: "mine", href: "/activities", label: dict.tabMyActivities },
        { key: "calendar", href: "/activities/calendar", label: dict.tabCalendar },
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
