import { describe, expect, it } from "vitest";

import {
  centerSearchQuerySchema,
  contactSearchQuerySchema,
  ROUTE_SEARCH_LIMIT,
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
