import { HelpCircle, Home, Users } from "lucide-react";

import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Permission } from "@/server/auth/permissions";

type NavKey = "home" | "users" | "installGuide";

export type NavItemDef = {
  href: string;
  key: NavKey;
  icon: typeof Home;
  // Omit to show the item to every signed-in user regardless of role.
  permission?: Permission;
};

export type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  permission?: Permission;
};

// The full navigation grows one item per story as each area of the app
// lands (attendance, visits, orders, reports, ...). Keep this list honest —
// only list a destination once its route actually exists.
export const NAV_ITEM_DEFS: NavItemDef[] = [
  { href: "/", key: "home", icon: Home },
  { href: "/admin/users", key: "users", icon: Users, permission: "users:manage" },
];

export const SECONDARY_NAV_ITEM_DEFS: NavItemDef[] = [
  { href: "/help/install", key: "installGuide", icon: HelpCircle },
];

// Resolves each item's translation key into display text for the current
// language — nav labels are UI chrome, translated like the rest of the
// shell, never database content.
export function resolveNavItems(defs: NavItemDef[], nav: Dictionary["nav"]): NavItem[] {
  return defs.map(({ key, ...item }) => ({ ...item, label: nav[key] }));
}
