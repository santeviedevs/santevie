import { HelpCircle, Home, Users } from "lucide-react";

import type { Permission } from "@/server/auth/permissions";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  // Omit to show the item to every signed-in user regardless of role.
  permission?: Permission;
};

// The full navigation grows one item per story as each area of the app
// lands (attendance, visits, orders, reports, ...). Keep this list honest —
// only list a destination once its route actually exists.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/admin/users", label: "Users", icon: Users, permission: "users:manage" },
];

export const SECONDARY_NAV_ITEMS: NavItem[] = [
  { href: "/help/install", label: "Install guide", icon: HelpCircle },
];
