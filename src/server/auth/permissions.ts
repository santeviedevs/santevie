// Single source of truth for the permission catalogue and the role matrix.
// prisma/seed.ts seeds exactly this list into the database, and
// require-permission.ts checks against exactly this list, so the two can
// never drift apart.
//
// This is a starting proposal, not a client-approved matrix (see decision
// D-style items in the execution plan: "seed the agreed matrix" implies
// sign-off is still needed). Adjust ROLE_PERMISSIONS once that's confirmed.

export const PERMISSIONS = [
  "users:manage",
  "roles:manage",
  "territories:manage",
  "clients:manage",
  "products:manage",
  "targets:manage",
  "orders:view-own",
  "orders:view-team",
  "orders:view-all",
  "orders:approve",
  "reports:view-own",
  "reports:view-team",
  "reports:view-all",
  "dashboard:view",
  "audit:view",
  "leave:apply",
  "leave:view-own",
  "leave:view-team",
  "leave:approve",
  "holidays:view",
  "holidays:manage",
  "working-days:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = ["ADMIN", "MANAGER", "SUPERVISOR", "DELEGATE"] as const;

export type RoleName = (typeof ROLES)[number];

export const ROLE_PERMISSIONS: Record<RoleName, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  MANAGER: [
    "territories:manage",
    "clients:manage",
    "products:manage",
    "targets:manage",
    "orders:view-all",
    "orders:approve",
    "reports:view-all",
    "dashboard:view",
    "audit:view",
    "leave:apply",
    "leave:view-own",
    "leave:view-team",
    "leave:approve",
    "holidays:view",
    "holidays:manage",
    "working-days:manage",
  ],
  SUPERVISOR: [
    "orders:view-team",
    "orders:approve",
    "reports:view-team",
    "leave:apply",
    "leave:view-own",
    "leave:view-team",
    "leave:approve",
    "holidays:view",
  ],
  DELEGATE: [
    "orders:view-own",
    "reports:view-own",
    "leave:apply",
    "leave:view-own",
    "holidays:view",
  ],
};

export function hasPermission(
  granted: readonly string[] | undefined,
  required: Permission,
): boolean {
  return granted?.includes(required) ?? false;
}
