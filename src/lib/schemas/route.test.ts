import { describe, expect, it } from "vitest";

import {
  assigneeSearchQuerySchema,
  assignRouteSchema,
  centerSearchQuerySchema,
  contactSearchQuerySchema,
  isRouteEditable,
  ROUTE_FILTER_STATUSES,
  ROUTE_SEARCH_LIMIT,
  ROUTE_TABLE_PAGE_SIZE,
  routeFiltersSchema,
  routeSearchQuerySchema,
  saveRouteContentSchema,
} from "./route";

describe("saveRouteContentSchema", () => {
  it("accepts several centers, each with several contacts", () => {
    const result = saveRouteContentSchema.safeParse({
      routeId: null,
      selections: [
        { centerId: "a", contactIds: ["c1", "c2"] },
        { centerId: "b", contactIds: ["c1"] },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a center with no contacts", () => {
    expect(
      saveRouteContentSchema.safeParse({ selections: [{ centerId: "a", contactIds: [] }] }).success,
    ).toBe(true);
  });

  it("rejects the same center twice", () => {
    const result = saveRouteContentSchema.safeParse({
      selections: [
        { centerId: "a", contactIds: [] },
        { centerId: "a", contactIds: [] },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects the same contact twice under one center", () => {
    const result = saveRouteContentSchema.safeParse({
      selections: [{ centerId: "a", contactIds: ["c1", "c1"] }],
    });
    expect(result.success).toBe(false);
  });

  it("allows the same contact under two different centers", () => {
    const result = saveRouteContentSchema.safeParse({
      selections: [
        { centerId: "a", contactIds: ["c1"] },
        { centerId: "b", contactIds: ["c1"] },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects blank ids", () => {
    expect(
      saveRouteContentSchema.safeParse({ selections: [{ centerId: "", contactIds: [] }] }).success,
    ).toBe(false);
    expect(
      saveRouteContentSchema.safeParse({ selections: [{ centerId: "a", contactIds: [""] }] })
        .success,
    ).toBe(false);
  });
});

describe("search query schemas", () => {
  it("defaults q to empty and limit to the ceiling", () => {
    const parsed = centerSearchQuerySchema.parse({});
    expect(parsed.q).toBe("");
    expect(parsed.limit).toBe(ROUTE_SEARCH_LIMIT);
  });

  it("never allows a limit above the ceiling", () => {
    expect(centerSearchQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(contactSearchQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(contactSearchQuerySchema.safeParse({ limit: "5" }).success).toBe(true);
  });

  it("trims q and caps its length", () => {
    expect(contactSearchQuerySchema.parse({ q: "  dr  " }).q).toBe("dr");
    expect(contactSearchQuerySchema.safeParse({ q: "x".repeat(101) }).success).toBe(false);
  });
});

describe("assignRouteSchema", () => {
  const base = { routeId: "r1", targetUserId: "u1" };

  it("accepts a start and an end date, including a one-day range", () => {
    expect(
      assignRouteSchema.safeParse({ ...base, startDate: "2026-06-16", endDate: "2026-06-30" })
        .success,
    ).toBe(true);
    expect(
      assignRouteSchema.safeParse({ ...base, startDate: "2026-06-16", endDate: "2026-06-16" })
        .success,
    ).toBe(true);
  });

  it("rejects an end date before the start date", () => {
    const result = assignRouteSchema.safeParse({
      ...base,
      startDate: "2026-06-20",
      endDate: "2026-06-16",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing, malformed or non-date values", () => {
    expect(assignRouteSchema.safeParse({ ...base }).success).toBe(false);
    expect(
      assignRouteSchema.safeParse({ ...base, startDate: "16/06/2026", endDate: "2026-06-30" })
        .success,
    ).toBe(false);
    expect(
      assignRouteSchema.safeParse({ ...base, startDate: "2026-06-16", endDate: "" }).success,
    ).toBe(false);
  });

  it("has no fixed one-week limit or maximum length", () => {
    expect(
      assignRouteSchema.safeParse({ ...base, startDate: "2026-06-16", endDate: "2027-06-16" })
        .success,
    ).toBe(true);
  });
});

describe("isRouteEditable", () => {
  const now = new Date("2026-06-15T10:00:00.000Z");

  it("is always editable while unassigned", () => {
    expect(isRouteEditable(null, now)).toBe(true);
  });

  it("is editable until the start date begins, in Kinshasa", () => {
    expect(isRouteEditable(new Date("2026-06-16T00:00:00.000Z"), now)).toBe(true);
    expect(isRouteEditable(new Date("2026-06-15T00:00:00.000Z"), now)).toBe(false);
  });

  it("locks a day early in the last UTC hour, because it is already tomorrow in Kinshasa", () => {
    expect(
      isRouteEditable(new Date("2026-06-16T00:00:00.000Z"), new Date("2026-06-15T23:30:00.000Z")),
    ).toBe(false);
  });
});

describe("routeFiltersSchema", () => {
  it("defaults to page 1 and a page size of 20", () => {
    const parsed = routeFiltersSchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(ROUTE_TABLE_PAGE_SIZE);
  });

  it("degrades malformed values to 'absent' instead of failing the page", () => {
    const parsed = routeFiltersSchema.parse({
      status: "NOPE",
      from: "not-a-date",
      to: "2026-13-45",
      page: "-3",
      pageSize: "abc",
    });
    expect(parsed.status).toBeUndefined();
    expect(parsed.from).toBeUndefined();
    expect(parsed.to).toBeUndefined();
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(ROUTE_TABLE_PAGE_SIZE);
  });

  it("treats UNASSIGNED as no status filter — the table only lists existing assignments", () => {
    expect(routeFiltersSchema.parse({ status: "UNASSIGNED" }).status).toBeUndefined();
    expect(ROUTE_FILTER_STATUSES).not.toContain("UNASSIGNED");
    expect(ROUTE_FILTER_STATUSES).toEqual([
      "ASSIGNED",
      "IN_PROGRESS",
      "MISSED",
      "COMPLETED",
      "CANCELLED",
    ]);
  });

  it("clamps an oversized page size to the ceiling", () => {
    expect(routeFiltersSchema.parse({ pageSize: "100000" }).pageSize).toBeLessThanOrEqual(100);
  });

  it("accepts the real filters", () => {
    expect(
      routeFiltersSchema.parse({
        q: " RT-1 ",
        assigneeId: "u1",
        status: "IN_PROGRESS",
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    ).toMatchObject({ q: "RT-1", assigneeId: "u1", status: "IN_PROGRESS" });
  });
});

describe("assign-form search schemas", () => {
  it("bound results by the same ceiling as the other searches", () => {
    expect(routeSearchQuerySchema.parse({}).limit).toBe(ROUTE_SEARCH_LIMIT);
    expect(assigneeSearchQuerySchema.safeParse({ limit: "999" }).success).toBe(false);
  });

  it("trim the query and cap its length", () => {
    expect(routeSearchQuerySchema.parse({ q: "  RT  " }).q).toBe("RT");
    expect(assigneeSearchQuerySchema.safeParse({ q: "x".repeat(101) }).success).toBe(false);
  });
});
