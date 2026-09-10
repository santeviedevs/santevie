import type { NavItem } from "./nav-items";
import { NavLink } from "./nav-link";

// Bottom tab bar for phones — the primary device for field delegates.
// Combines both nav groups into one row since there's no sidebar to hold
// the secondary items (install guide, etc.) on this breakpoint.
export function BottomNav({
  items,
  secondaryItems,
}: {
  items: NavItem[];
  secondaryItems: NavItem[];
}) {
  const allItems = [...items, ...secondaryItems];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Primary"
    >
      {allItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={<Icon className="size-5 shrink-0" aria-hidden="true" />}
            className="flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium"
            activeClassName="text-primary"
            inactiveClassName="text-muted-foreground"
          />
        );
      })}
    </nav>
  );
}
