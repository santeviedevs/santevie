import {
  Calendar,
  CalendarDays,
  HelpCircle,
  Home,
  Map,
  MapPin,
  Package,
  Stethoscope,
  Users,
} from "lucide-react";

import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Permission } from "@/server/auth/permissions";

type NavKey =
  | "home"
  | "users"
  | "territoriesGroup"
  | "manageTerritories"
  | "territoryAssignment"
  | "calendar"
  | "attendanceGroup"
  | "checkIn"
  | "team"
  | "leavesGroup"
  | "myLeaves"
  | "teamLeaves"
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
  // Visible to everyone — the page itself gates on leave:view-own, which
  // every role holds. Holidays (holidays:view, also universal) lives inside
  // it as a tab, not a separate nav entry.
  { href: "/calendar", key: "calendar", icon: Calendar },
  // Grouped like territoriesGroup/leavesGroup, even though Check In is the
  // only child today — Check Out (S3-03) and the attendance admin/report
  // screen (S3-05) land in this same sprint, so the group shape is already
  // correct rather than something to flatten and later regroup.
  {
    key: "attendanceGroup",
    icon: MapPin,
    children: [
      // All four roles currently hold attendance:check-in (S3-02) — kept as
      // an explicit permission gate anyway, defense-in-depth against a
      // future role that doesn't, rather than relying on it being universal
      // today.
      { href: "/attendance/check-in", key: "checkIn", permission: "attendance:check-in" },
    ],
  },
  {
    href: "/team",
    key: "team",
    icon: Users,
    anyPermission: ["reports:view-team", "reports:view-all"],
  },
  {
    key: "leavesGroup",
    icon: CalendarDays,
    children: [
      { href: "/leaves/my", key: "myLeaves", permission: "leave:view-own" },
      { href: "/leaves/team", key: "teamLeaves", permission: "leave:view-team" },
    ],
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
