import type { NavItem } from "./nav-items";
import { NavLink } from "./nav-link";

const LINK_CLASS =
  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors";
const ACTIVE_CLASS = "bg-sidebar-accent text-sidebar-accent-foreground";
const INACTIVE_CLASS =
  "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

export function SidebarNav({
  items,
  secondaryItems,
}: {
  items: NavItem[];
  secondaryItems: NavItem[];
}) {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4 font-heading text-sm font-semibold">
        ALISONS
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={<Icon className="size-5 shrink-0" aria-hidden="true" />}
              className={LINK_CLASS}
              activeClassName={ACTIVE_CLASS}
              inactiveClassName={INACTIVE_CLASS}
            />
          );
        })}
      </nav>
      <nav className="flex flex-col gap-1 border-t border-sidebar-border p-3">
        {secondaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={<Icon className="size-5 shrink-0" aria-hidden="true" />}
              className={LINK_CLASS}
              activeClassName={ACTIVE_CLASS}
              inactiveClassName={INACTIVE_CLASS}
            />
          );
        })}
      </nav>
    </aside>
  );
}
