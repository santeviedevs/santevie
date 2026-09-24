import { HelpCircle, Home, Map, Package, Stethoscope, Users } from "lucide-react";

import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Permission } from "@/server/auth/permissions";

type NavKey =
  | "home"
  | "users"
  | "territoriesGroup"
  | "manageTerritories"
  | "territoryAssignment"
  | "team"
  | "clients"
  | "products"
  | "installGuide";

export type NavChildDef = { href: string; key: NavKey; permission?: Permission };
export type NavChild = { href: string; label: string; permission?: Permission };

export type NavItemDef = {
  // Present on a plain item, absent on a group (a group navigates via its
  // children instead).
  href?: string;
  key: NavKey;
  icon: typeof Home;
  // Omit both to show the item to every signed-in user regardless of role.
  permission?: Permission;
  // For an item reachable through more than one permission — e.g. Team:
  // reports:view-team (Supervisor) and reports:view-all (Manager, Admin)
  // both mean "can see a team roster" here, even though they're different
  // grants in the role matrix. Any one of these being held is enough; use
  // `permission` instead when there's only one.
  anyPermission?: Permission[];
  // Present turns this into a dropdown group (e.g. "Territories" holding
  // "Manage Territories" and "Assign Territories") — see nav-dropdown.tsx.
  children?: NavChildDef[];
};

export type NavItem = {
  href?: string;
  label: string;
  icon: typeof Home;
  permission?: Permission;
  anyPermission?: Permission[];
  children?: NavChild[];
};

// The full navigation grows one item per story as each area of the app
// lands (attendance, visits, orders, reports, ...). Keep this list honest —
// only list a destination once its route actually exists.
export const NAV_ITEM_DEFS: NavItemDef[] = [
  { href: "/", key: "home", icon: Home },
  { href: "/admin/users", key: "users", icon: Users, permission: "users:manage" },
  {
    key: "territoriesGroup",
    icon: Map,
    children: [
      { href: "/admin/territories", key: "manageTerritories", permission: "territories:manage" },
      {
        href: "/admin/territories/assignment",
        key: "territoryAssignment",
        permission: "territories:manage",
      },
    ],
  },
  {
    href: "/team",
    key: "team",
    icon: Users,
    anyPermission: ["reports:view-team", "reports:view-all"],
  },
  { href: "/admin/clients", key: "clients", icon: Stethoscope, permission: "clients:manage" },
  { href: "/admin/products", key: "products", icon: Package, permission: "products:manage" },
];

export const SECONDARY_NAV_ITEM_DEFS: NavItemDef[] = [
  { href: "/help/install", key: "installGuide", icon: HelpCircle },
];

// Resolves each item's (and each child's) translation key into display text
// for the current language — nav labels are UI chrome, translated like the
// rest of the shell, never database content.
export function resolveNavItems(defs: NavItemDef[], nav: Dictionary["nav"]): NavItem[] {
  return defs.map(({ key, children, ...item }) => ({
    ...item,
    label: nav[key],
    children: children?.map(({ key: childKey, ...child }) => ({ ...child, label: nav[childKey] })),
  }));
}
