import Link from "next/link";

import type { Dictionary } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";

// Everyone has My follow-ups; Team follow-ups is added for anyone holding
// activities:view-team (managers and supervisors).
export function FollowUpTabs({
  active,
  canViewTeam,
  dict,
}: {
  active: "mine" | "team";
  canViewTeam: boolean;
  dict: Dictionary["activitiesPage"];
}) {
  const tabs: { key: "mine" | "team"; href: string; label: string }[] = [
    { key: "mine", href: "/activities/follow-ups", label: dict.tabMyFollowUps },
    ...(canViewTeam
      ? [
          {
            key: "team" as const,
            href: "/activities/follow-ups/team",
            label: dict.tabTeamFollowUps,
          },
        ]
      : []),
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
