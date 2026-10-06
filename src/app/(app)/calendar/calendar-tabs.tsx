import Link from "next/link";

import type { Dictionary } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";

// Two separate routes (/calendar, /calendar/holidays), each with its own
// server-side data fetch — this is navigation between them, not a
// client-toggled panel, so it's a plain Link-based pill bar rather than the
// unused Tabs UI primitive (which is built for controlled-value panel
// switching, not route navigation).
export function CalendarTabs({
  active,
  dict,
}: {
  active: "calendar" | "holidays";
  dict: Dictionary["calendarPage"];
}) {
  const tabs = [
    { key: "calendar" as const, href: "/calendar", label: dict.tabCalendar },
    { key: "holidays" as const, href: "/calendar/holidays", label: dict.tabHolidays },
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
