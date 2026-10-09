import { CalendarCheck, Route } from "lucide-react";
import { describe, expect, it } from "vitest";

import { hasPermission, ROLE_PERMISSIONS, ROLES } from "@/server/auth/permissions";

import { NAV_ITEM_DEFS } from "./nav-items";

const routes = NAV_ITEM_DEFS.find((item) => item.key === "routes");
const visits = NAV_ITEM_DEFS.find((item) => item.key === "visits");

function canSee(role: (typeof ROLES)[number], item: typeof routes) {
  return !item?.permission || hasPermission(ROLE_PERMISSIONS[role], item.permission);
}

describe("Routes and Visits navigation", () => {
  it("uses the route and calendar-check icons on separate sidebar items", () => {
    expect(routes?.icon).toBe(Route);
    expect(routes?.href).toBe("/routes");
    expect(visits?.icon).toBe(CalendarCheck);
    expect(visits?.href).toBe("/visits");
  });

  it.each([
    ["ADMIN", true, true],
    ["MANAGER", true, true],
    ["SUPERVISOR", true, true],
    ["DELEGATE", false, true],
  ] as const)("%s: routes=%s visits=%s", (role, routesVisible, visitsVisible) => {
    expect(canSee(role, routes)).toBe(routesVisible);
    expect(canSee(role, visits)).toBe(visitsVisible);
  });
});
