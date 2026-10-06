import { describe, expect, it } from "vitest";

import {
  hasPermission,
  type Permission,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES,
} from "./permissions";

// Hardcoded independently of ROLE_PERMISSIONS so an accidental edit to the
// matrix in permissions.ts is caught here rather than silently reflected in
// both places. Update this table only when a permission change is deliberate
// and agreed, per S1-05 ("seed the agreed matrix").
const EXPECTED: Record<(typeof ROLES)[number], Permission[]> = {
  ADMIN: [...PERMISSIONS],
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
    "attendance:check-in",
    "attendance:check-out",
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
    "attendance:check-in",
    "attendance:check-out",
  ],
  DELEGATE: [
    "orders:view-own",
    "reports:view-own",
    "leave:apply",
    "leave:view-own",
    "holidays:view",
    "attendance:check-in",
    "attendance:check-out",
  ],
};

describe("role permission matrix", () => {
  for (const role of ROLES) {
    describe(role, () => {
      for (const permission of PERMISSIONS) {
        const expected = EXPECTED[role].includes(permission);

        it(`${expected ? "allows" : "denies"} ${permission}`, () => {
          expect(hasPermission(ROLE_PERMISSIONS[role], permission)).toBe(expected);
        });
      }
    });
  }
});

describe("hasPermission", () => {
  it("denies when the permission list is undefined", () => {
    expect(hasPermission(undefined, "orders:view-own")).toBe(false);
  });

  it("denies when the permission is not in the list", () => {
    expect(hasPermission(["orders:view-own"], "orders:approve")).toBe(false);
  });

  it("allows when the permission is in the list", () => {
    expect(hasPermission(["orders:view-own"], "orders:view-own")).toBe(true);
  });
});
