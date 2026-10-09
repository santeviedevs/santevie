import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findCenterById = vi.fn();
vi.mock("@/server/repositories/center-repository", () => ({ findCenterById }));

const assignRouteRow = vi.fn();
const cancelPendingRouteItems = vi.fn();
const createRouteItem = vi.fn();
const createRouteRow = vi.fn();
const deleteRouteItem = vi.fn();
const deleteRouteRow = vi.fn();
const findActiveCenterIdsForVisitorOnDate = vi.fn();
const findAssignableRoutes = vi.fn();
const findEditableRoutes = vi.fn();
const findRouteById = vi.fn();
const findRouteItemById = vi.fn();
const findRoutesForVisitor = vi.fn();
const moveRouteItems = vi.fn();
const updateRouteItemSequence = vi.fn();
const updateRouteItemStatus = vi.fn();
vi.mock("@/server/repositories/route-repository", () => ({
  assignRouteRow,
  cancelPendingRouteItems,
  createRouteItem,
  createRouteRow,
  deleteRouteItem,
  deleteRouteRow,
  findActiveCenterIdsForVisitorOnDate,
  findAssignableRoutes,
  findEditableRoutes,
  findRouteById,
  findRouteItemById,
  findRoutesForVisitor,
  moveRouteItems,
  updateRouteItemSequence,
  updateRouteItemStatus,
}));

const listAssignmentsForUser = vi.fn();
vi.mock("@/server/repositories/territory-assignment-repository", () => ({
  listAssignmentsForUser,
}));

const findUserById = vi.fn();
const findUsersByIds = vi.fn();
vi.mock("@/server/repositories/user-repository", () => ({ findUserById, findUsersByIds }));

const getDownstreamUserIds = vi.fn();
vi.mock("@/server/scope", () => ({ getDownstreamUserIds }));

const {
  saveRouteContent,
  reorderRouteItems,
  completeRouteItem,
  cancelRouteItem,
  assignRoute,
  cancelRouteAssignment,
  getRoutesForContent,
  getMyVisits,
  RouteEditCutoffError,
  CenterOutsideTerritoryError,
  DuplicateCenterOnRouteError,
  RouteNotAuthorizedError,
  RouteNotOwnedError,
  RouteHasCompletedItemsError,
} = await import("./route-service");

const TODAY = new Date("2026-06-15T00:00:00.000Z");
const TOMORROW = new Date("2026-06-16T00:00:00.000Z");
const YESTERDAY = new Date("2026-06-14T00:00:00.000Z");

function route(overrides: Record<string, unknown> = {}) {
  return {
    id: "route-1",
    userId: null,
    date: null,
    createdBy: "creator-1",
    items: [],
    ...overrides,
  };
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    centerId: "center-1",
    sequence: 0,
    status: "PENDING",
    center: { id: "center-1", territoryId: "territory-1" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(TODAY);
  findUserById.mockResolvedValue({ territoryId: null });
  findUsersByIds.mockResolvedValue([]);
  listAssignmentsForUser.mockResolvedValue([{ territoryId: "territory-1" }]);
  createRouteRow.mockResolvedValue({ id: "route-1" });
  createRouteItem.mockResolvedValue({ id: "item-1", sequence: 0, status: "PENDING" });
  getDownstreamUserIds.mockResolvedValue([]);
  findActiveCenterIdsForVisitorOnDate.mockResolvedValue(new Set());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("saveRouteContent — creation", () => {
  it("creates a bare route when routeId is null and saves the draft's centers onto it", async () => {
    findCenterById.mockResolvedValue({ id: "center-1", territoryId: "territory-1" });

    await expect(saveRouteContent(null, ["center-1"], "creator-1", "SUPERVISOR")).resolves.toBe(
      "route-1",
    );
    expect(createRouteRow).toHaveBeenCalledWith("creator-1");
    expect(createRouteItem).toHaveBeenCalledWith(expect.objectContaining({ sequence: 0 }));
  });

  it("never looks up an existing route when routeId is null", async () => {
    findCenterById.mockResolvedValue({ id: "center-1", territoryId: "territory-1" });

    await saveRouteContent(null, ["center-1"], "creator-1", "SUPERVISOR");
    expect(findRouteById).not.toHaveBeenCalled();
  });
});

describe("saveRouteContent — authorization", () => {
  it("allows the creator to save their own unassigned route", async () => {
    findRouteById.mockResolvedValue(route());

    await expect(saveRouteContent("route-1", [], "creator-1", "SUPERVISOR")).resolves.toBe(
      "route-1",
    );
  });

  it("rejects someone else saving a still-unassigned route they didn't create", async () => {
    findRouteById.mockResolvedValue(route());

    await expect(saveRouteContent("route-1", [], "someone-else", "SUPERVISOR")).rejects.toThrow(
      RouteNotAuthorizedError,
    );
  });

  it("allows ADMIN to save anyone's unassigned route", async () => {
    findRouteById.mockResolvedValue(route());

    await expect(saveRouteContent("route-1", [], "admin-1", "ADMIN")).resolves.toBe("route-1");
  });

  it("allows a chain-assignor to save an already-assigned route", async () => {
    findRouteById.mockResolvedValue(route({ userId: "delegate-1", date: TOMORROW }));
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await expect(saveRouteContent("route-1", [], "supervisor-1", "SUPERVISOR")).resolves.toBe(
      "route-1",
    );
  });

  it("rejects saving once the assigned route's date has started", async () => {
    findRouteById.mockResolvedValue(route({ userId: "delegate-1", date: TODAY }));

    await expect(saveRouteContent("route-1", [], "delegate-1", "DELEGATE")).rejects.toThrow(
      RouteEditCutoffError,
    );
  });

  it("never gates an unassigned route by the edit cutoff", async () => {
    findRouteById.mockResolvedValue(route());

    await expect(saveRouteContent("route-1", [], "creator-1", "SUPERVISOR")).resolves.toBe(
      "route-1",
    );
  });
});

describe("saveRouteContent — territory and duplicate validation", () => {
  it("validates new centers against the creator's territories while unassigned", async () => {
    findRouteById.mockResolvedValue(route());
    findCenterById.mockResolvedValue({ id: "center-1", territoryId: "territory-outside" });

    await expect(
      saveRouteContent("route-1", ["center-1"], "creator-1", "SUPERVISOR"),
    ).rejects.toThrow(CenterOutsideTerritoryError);
  });

  it("validates new centers against the visitor's territories once assigned", async () => {
    findRouteById.mockResolvedValue(route({ userId: "delegate-1", date: TOMORROW }));
    listAssignmentsForUser.mockResolvedValue([]);
    findUserById.mockResolvedValue({ territoryId: "delegate-territory" });
    findCenterById.mockResolvedValue({ id: "center-1", territoryId: "territory-1" });

    await expect(
      saveRouteContent("route-1", ["center-1"], "delegate-1", "DELEGATE"),
    ).rejects.toThrow(CenterOutsideTerritoryError);
  });

  it("rejects a new center already active for this visitor on this date on a different route", async () => {
    findRouteById.mockResolvedValue(route({ userId: "delegate-1", date: TOMORROW }));
    findActiveCenterIdsForVisitorOnDate.mockResolvedValue(new Set(["center-1"]));
    findCenterById.mockResolvedValue({ id: "center-1", territoryId: "territory-1" });

    await expect(
      saveRouteContent("route-1", ["center-1"], "delegate-1", "DELEGATE"),
    ).rejects.toThrow(DuplicateCenterOnRouteError);
  });

  it("never runs the cross-route duplicate check while unassigned (no date to check against)", async () => {
    findRouteById.mockResolvedValue(route());
    findCenterById.mockResolvedValue({ id: "center-1", territoryId: "territory-1" });

    await saveRouteContent("route-1", ["center-1"], "creator-1", "SUPERVISOR");
    expect(findActiveCenterIdsForVisitorOnDate).not.toHaveBeenCalled();
  });
});

describe("saveRouteContent — diffing against existing items", () => {
  it("removes a PENDING item no longer in the desired list", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()] }));

    await saveRouteContent("route-1", [], "creator-1", "SUPERVISOR");
    expect(deleteRouteItem).toHaveBeenCalledWith("item-1");
  });

  it("resequences a kept item instead of recreating it", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()] }));

    await saveRouteContent("route-1", ["center-1"], "creator-1", "SUPERVISOR");
    expect(updateRouteItemSequence).toHaveBeenCalledWith("item-1", 0, "creator-1");
    expect(createRouteItem).not.toHaveBeenCalled();
    expect(deleteRouteItem).not.toHaveBeenCalled();
  });

  it("creates new items only for centers not already on the route", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()] }));
    findCenterById.mockResolvedValue({ id: "center-2", territoryId: "territory-1" });

    await saveRouteContent("route-1", ["center-1", "center-2"], "creator-1", "SUPERVISOR");
    expect(updateRouteItemSequence).toHaveBeenCalledWith("item-1", 0, "creator-1");
    expect(createRouteItem).toHaveBeenCalledWith(expect.objectContaining({ sequence: 1 }));
  });

  it("never touches a COMPLETED or CANCELLED item even if it's left out of the desired list", async () => {
    findRouteById.mockResolvedValue(
      route({
        userId: "delegate-1",
        date: TOMORROW,
        items: [item({ status: "COMPLETED" })],
      }),
    );

    await saveRouteContent("route-1", [], "delegate-1", "DELEGATE");
    expect(deleteRouteItem).not.toHaveBeenCalled();
  });
});

describe("reorderRouteItems", () => {
  it("is never gated by the edit cutoff, even on an assigned, already-started route", async () => {
    findRouteById.mockResolvedValue(route({ userId: "delegate-1", date: TODAY }));

    await reorderRouteItems("route-1", ["item-1"], "delegate-1", "DELEGATE");
    expect(updateRouteItemSequence).toHaveBeenCalledWith("item-1", 0, "delegate-1");
  });
});

describe("completeRouteItem / cancelRouteItem", () => {
  it("completeRouteItem rejects anyone but the visitor, even an in-chain supervisor", async () => {
    findRouteItemById.mockResolvedValue({ id: "item-1", route: { userId: "delegate-1" } });

    await expect(completeRouteItem("item-1", "supervisor-1")).rejects.toThrow(RouteNotOwnedError);
  });

  it("cancelRouteItem rejects acting on a still-unassigned route's item (nothing to cancel yet)", async () => {
    findRouteItemById.mockResolvedValue({ id: "item-1", route: route() });

    await expect(cancelRouteItem("item-1", "creator-1", "SUPERVISOR")).rejects.toThrow(
      RouteNotAuthorizedError,
    );
  });
});

describe("assignRoute — first-time assignment", () => {
  it("assigns an unassigned route in place", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()] }));
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await expect(
      assignRoute("route-1", "delegate-1", TOMORROW, "supervisor-1", "SUPERVISOR"),
    ).resolves.toBe("route-1");
    expect(assignRouteRow).toHaveBeenCalledWith("route-1", "delegate-1", TOMORROW, "supervisor-1");
    expect(createRouteRow).not.toHaveBeenCalled();
  });

  it("rejects assigning to a target outside the actor's downstream chain", async () => {
    findRouteById.mockResolvedValue(route());
    getDownstreamUserIds.mockResolvedValue([]);

    await expect(
      assignRoute("route-1", "someone-else", TOMORROW, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(RouteNotAuthorizedError);
    expect(assignRouteRow).not.toHaveBeenCalled();
  });

  it("validates every item's territory against the target before assigning", async () => {
    findRouteById.mockResolvedValue(
      route({ items: [item({ center: { id: "center-1", territoryId: "other-territory" } })] }),
    );
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await expect(
      assignRoute("route-1", "delegate-1", TOMORROW, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(CenterOutsideTerritoryError);
    expect(assignRouteRow).not.toHaveBeenCalled();
  });

  it("validates no item is already planned for the target on that date elsewhere", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()] }));
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);
    findActiveCenterIdsForVisitorOnDate.mockResolvedValue(new Set(["center-1"]));

    await expect(
      assignRoute("route-1", "delegate-1", TOMORROW, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(DuplicateCenterOnRouteError);
  });
});

describe("assignRoute — reassignment", () => {
  it("creates a new route, moves items, and deletes the source — never updates in place", async () => {
    findRouteById.mockResolvedValue(
      route({ id: "old-route", userId: "delegate-1", date: TOMORROW, items: [item()] }),
    );
    createRouteRow.mockResolvedValue({ id: "new-route" });
    getDownstreamUserIds.mockResolvedValue(["delegate-1", "delegate-2"]);

    const result = await assignRoute(
      "old-route",
      "delegate-2",
      TOMORROW,
      "supervisor-1",
      "SUPERVISOR",
    );

    expect(result).toBe("new-route");
    expect(createRouteRow).toHaveBeenCalledWith("supervisor-1");
    expect(assignRouteRow).toHaveBeenCalledWith(
      "new-route",
      "delegate-2",
      TOMORROW,
      "supervisor-1",
    );
    expect(moveRouteItems).toHaveBeenCalledWith("old-route", "new-route");
    expect(deleteRouteRow).toHaveBeenCalledWith("old-route");
  });

  it("refuses to reassign a route with any COMPLETED item", async () => {
    findRouteById.mockResolvedValue(
      route({
        id: "old-route",
        userId: "delegate-1",
        date: TOMORROW,
        items: [item({ status: "COMPLETED" }), item({ id: "item-2", status: "PENDING" })],
      }),
    );
    getDownstreamUserIds.mockResolvedValue(["delegate-1", "delegate-2"]);

    await expect(
      assignRoute("old-route", "delegate-2", TOMORROW, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(RouteHasCompletedItemsError);
    expect(createRouteRow).not.toHaveBeenCalled();
    expect(moveRouteItems).not.toHaveBeenCalled();
  });
});

describe("cancelRouteAssignment", () => {
  it("bulk-cancels every still-PENDING item, authorized the same as any other route action", async () => {
    findRouteById.mockResolvedValue(route({ userId: "delegate-1", date: TOMORROW }));
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await cancelRouteAssignment("route-1", "supervisor-1", "SUPERVISOR");
    expect(cancelPendingRouteItems).toHaveBeenCalledWith("route-1", "supervisor-1");
  });

  it("does nothing for a still-unassigned route", async () => {
    findRouteById.mockResolvedValue(route());

    await cancelRouteAssignment("route-1", "creator-1", "SUPERVISOR");
    expect(cancelPendingRouteItems).not.toHaveBeenCalled();
  });
});

describe("getRoutesForContent / getMyVisits — MISSED is computed, never stored", () => {
  it("displays a PENDING item as MISSED once its route date has passed", async () => {
    findEditableRoutes.mockResolvedValue([
      route({ userId: "delegate-1", date: YESTERDAY, items: [item()] }),
    ]);

    const result = await getRoutesForContent("supervisor-1", "SUPERVISOR");
    expect(result[0]?.items[0]?.status).toBe("MISSED");
  });

  it("keeps a PENDING item as PENDING for a future date", async () => {
    findRoutesForVisitor.mockResolvedValue([
      route({ userId: "delegate-1", date: TOMORROW, items: [item()] }),
    ]);

    const result = await getMyVisits("delegate-1");
    expect(result[0]?.items[0]?.status).toBe("PENDING");
  });

  it("never relabels a COMPLETED item as MISSED, even for a past date", async () => {
    findRoutesForVisitor.mockResolvedValue([
      route({ userId: "delegate-1", date: YESTERDAY, items: [item({ status: "COMPLETED" })] }),
    ]);

    const result = await getMyVisits("delegate-1");
    expect(result[0]?.items[0]?.status).toBe("COMPLETED");
  });

  it("an unassigned route (no date) is never shown as editable=false and never MISSED", async () => {
    findEditableRoutes.mockResolvedValue([route({ items: [item()] })]);

    const result = await getRoutesForContent("creator-1", "SUPERVISOR");
    expect(result[0]?.editable).toBe(true);
    expect(result[0]?.items[0]?.status).toBe("PENDING");
  });
});
