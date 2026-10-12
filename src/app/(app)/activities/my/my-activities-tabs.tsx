import Link from "next/link";

import type { Dictionary } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";

type MyActivitiesTabKey = "activities" | "calendar";

// Pill bar for the standalone My Activities screen: the viewer's own
// assignments, and their own calendar — never follow-ups, which is its own
// separate sidebar entry (Marketing > Follow-Ups), not bundled in here.
export function MyActivitiesTabs({
  active,
  dict,
}: {
  active: MyActivitiesTabKey;
  dict: Dictionary["activitiesPage"];
}) {
  const tabs: { key: MyActivitiesTabKey; href: string; label: string }[] = [
    { key: "activities", href: "/activities/my", label: dict.subTabActivities },
    { key: "calendar", href: "/activities/my/calendar", label: dict.tabCalendar },
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
