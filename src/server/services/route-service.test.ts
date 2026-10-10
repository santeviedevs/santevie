import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TX = { tx: true };

const findCenterById = vi.fn();
const searchActiveCentersInTerritories = vi.fn();
vi.mock("@/server/repositories/center-repository", () => ({
  findCenterById,
  searchActiveCentersInTerritories,
}));

const findCenterContactLinks = vi.fn();
const searchContactsForCenter = vi.fn();
vi.mock("@/server/repositories/contact-repository", () => ({
  findCenterContactLinks,
  searchContactsForCenter,
}));

const assignRouteRow = vi.fn();
const cancelPendingContactlessRouteItems = vi.fn();
const cancelPendingContactsOnItem = vi.fn();
const cancelPendingContactsOnRoute = vi.fn();
const createRouteItem = vi.fn();
const createRouteItemContacts = vi.fn();
const createRouteRow = vi.fn();
const deleteNonCompletedRouteItemContacts = vi.fn();
const deletePendingRouteItemContacts = vi.fn();
const deleteRouteItem = vi.fn();
const findActiveCenterIdsForVisitorInRange = vi.fn();
const findEditableRoutes = vi.fn();
const findRouteById = vi.fn();
const findRouteItemById = vi.fn();
const findRouteItemContactById = vi.fn();
const findRoutesForVisitor = vi.fn();
const findRoutesForVisitorOverlapping = vi.fn();
const findRoutesPage = vi.fn();
const searchAssignableRoutes = vi.fn();
const createRouteAssignmentRow = vi.fn();
const listContactStatusesForItem = vi.fn();
const listPendingItemIdsWithContacts = vi.fn();
const runInTransaction = vi.fn(async (fn: (tx: typeof TX) => Promise<unknown>) => fn(TX));
const updateRouteItemContactStatus = vi.fn();
const updateRouteItemSequence = vi.fn();
const updateRouteItemStatus = vi.fn();
vi.mock("@/server/repositories/route-repository", () => ({
  assignRouteRow,
  cancelPendingContactlessRouteItems,
  cancelPendingContactsOnItem,
  cancelPendingContactsOnRoute,
  createRouteItem,
  createRouteItemContacts,
  createRouteRow,
  deleteNonCompletedRouteItemContacts,
  deletePendingRouteItemContacts,
  deleteRouteItem,
  findActiveCenterIdsForVisitorInRange,
  findEditableRoutes,
  findRouteById,
  findRouteItemById,
  findRouteItemContactById,
  findRoutesForVisitor,
  findRoutesForVisitorOverlapping,
  findRoutesPage,
  searchAssignableRoutes,
  createRouteAssignmentRow,
  listContactStatusesForItem,
  listPendingItemIdsWithContacts,
  runInTransaction,
  updateRouteItemContactStatus,
  updateRouteItemSequence,
  updateRouteItemStatus,
}));

const listAssignmentsForUser = vi.fn();
vi.mock("@/server/repositories/territory-assignment-repository", () => ({
  listAssignmentsForUser,
}));

const findUserById = vi.fn();
const findUsersByIds = vi.fn();
const searchActiveUsers = vi.fn();
vi.mock("@/server/repositories/user-repository", () => ({
  findUserById,
  findUsersByIds,
  searchActiveUsers,
}));

const getDownstreamUserIds = vi.fn();
vi.mock("@/server/scope", () => ({ getDownstreamUserIds }));

const {
  saveRouteContent,
  reorderRouteItems,
  completeRouteItem,
  cancelRouteItem,
  assignRoute,
  reassignRoute,
  cancelRouteAssignment,
  getRoutesForContent,
  getMyVisits,
  completeRouteItemContact,
  cancelRouteItemContact,
  deriveCenterStatus,
  deriveRouteStatus,
  listRoutesForAssignment,
  getRouteForManagement,
  getMyRoutesForHome,
  searchAssignableRoutesForActor,
  searchAssigneesForActor,
  getAssigneeFilterLabel,
  searchCentersForRoute,
  searchContactsForRouteCenter,
  RouteEditCutoffError,
  AssigneeNotAssignableError,
  CenterAlreadyOnRouteError,
  InvalidDateRangeError,
  RouteAlreadyAssignedError,
  RouteHasNothingToAssignError,
  RouteNotAssignedError,
  RouteStartInPastError,
  CenterNotFoundError,
  CenterOutsideTerritoryError,
  CenterStatusDerivedError,
  ContactAlreadyOnRouteError,
  ContactStatusConflictError,
  DuplicateCenterOnRouteError,
  InactiveCenterError,
  InvalidCenterContactError,
  RouteItemHasCompletedContactsError,
  RouteNotAuthorizedError,
  RouteNotOwnedError,
  RouteHasCompletedItemsError,
} = await import("./route-service");

// A selection with no contacts — the pre-contacts shape of "a center on the route".
function sel(...centerIds: string[]) {
  return centerIds.map((centerId) => ({ centerId, contactIds: [] as string[] }));
}

function link(centerId: string, contactId: string, status: "ACTIVE" | "INACTIVE" = "ACTIVE") {
  return { centerId, contactId, contact: { status } };
}

function contactRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "rc-1",
    routeItemId: "item-1",
    contactId: "contact-1",
    status: "PENDING",
    contact: { id: "contact-1", name: "Dr One", code: "CON-00001", status: "ACTIVE" },
    ...overrides,
  };
}

const TODAY = new Date("2026-06-15T00:00:00.000Z");
const TOMORROW = new Date("2026-06-16T00:00:00.000Z");
const YESTERDAY = new Date("2026-06-14T00:00:00.000Z");

function route(overrides: Record<string, unknown> = {}) {
  return {
    id: "route-1",
    code: "RT-00001",
    userId: null,
    startDate: null,
    endDate: null,
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
    center: {
      id: "center-1",
      territoryId: "territory-1",
      name: "Center",
      code: "C-1",
      type: { name: "Hospital" },
    },
    contacts: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(TODAY);
  findUserById.mockResolvedValue({ territoryId: null, status: "ACTIVE" });
  findUsersByIds.mockResolvedValue([]);
  listAssignmentsForUser.mockResolvedValue([{ territoryId: "territory-1" }]);
  createRouteRow.mockResolvedValue({ id: "route-1" });
  createRouteItem.mockResolvedValue({ id: "item-1", sequence: 0, status: "PENDING" });
  getDownstreamUserIds.mockResolvedValue([]);
  findActiveCenterIdsForVisitorInRange.mockResolvedValue(new Set());
  findCenterContactLinks.mockResolvedValue([]);
  listContactStatusesForItem.mockResolvedValue([]);
  listPendingItemIdsWithContacts.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("saveRouteContent — creation", () => {
  it("creates a bare route when routeId is null and saves the draft's centers onto it", async () => {
    findCenterById.mockResolvedValue({
      id: "center-1",
      territoryId: "territory-1",
      status: "ACTIVE",
    });

    await expect(saveRouteContent(null, sel("center-1"), "creator-1", "SUPERVISOR")).resolves.toBe(
      "route-1",
    );
    expect(createRouteRow).toHaveBeenCalledWith("creator-1", TX);
    expect(createRouteItem).toHaveBeenCalledWith(expect.objectContaining({ sequence: 0 }), TX);
  });

  it("never looks up an existing route when routeId is null", async () => {
    findCenterById.mockResolvedValue({
      id: "center-1",
      territoryId: "territory-1",
      status: "ACTIVE",
    });

    await saveRouteContent(null, sel("center-1"), "creator-1", "SUPERVISOR");
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
    findRouteById.mockResolvedValue(
      route({ userId: "delegate-1", startDate: TOMORROW, endDate: TOMORROW }),
    );
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await expect(saveRouteContent("route-1", [], "supervisor-1", "SUPERVISOR")).resolves.toBe(
      "route-1",
    );
  });

  it("rejects saving once the assigned route's date has started", async () => {
    findRouteById.mockResolvedValue(
      route({ userId: "delegate-1", startDate: TODAY, endDate: TODAY }),
    );

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
    findCenterById.mockResolvedValue({
      id: "center-1",
      territoryId: "territory-outside",
      status: "ACTIVE",
    });

    await expect(
      saveRouteContent("route-1", sel("center-1"), "creator-1", "SUPERVISOR"),
    ).rejects.toThrow(CenterOutsideTerritoryError);
  });

  it("validates new centers against the visitor's territories once assigned", async () => {
    findRouteById.mockResolvedValue(
      route({ userId: "delegate-1", startDate: TOMORROW, endDate: TOMORROW }),
    );
    listAssignmentsForUser.mockResolvedValue([]);
    findUserById.mockResolvedValue({ territoryId: "delegate-territory" });
    findCenterById.mockResolvedValue({
      id: "center-1",
      territoryId: "territory-1",
      status: "ACTIVE",
    });

    await expect(
      saveRouteContent("route-1", sel("center-1"), "delegate-1", "DELEGATE"),
    ).rejects.toThrow(CenterOutsideTerritoryError);
  });

  it("rejects a new center already active for this visitor on this date on a different route", async () => {
    findRouteById.mockResolvedValue(
      route({ userId: "delegate-1", startDate: TOMORROW, endDate: TOMORROW }),
    );
    findActiveCenterIdsForVisitorInRange.mockResolvedValue(new Set(["center-1"]));
    findCenterById.mockResolvedValue({
      id: "center-1",
      territoryId: "territory-1",
      status: "ACTIVE",
    });

    await expect(
      saveRouteContent("route-1", sel("center-1"), "delegate-1", "DELEGATE"),
    ).rejects.toThrow(DuplicateCenterOnRouteError);
  });

  it("never runs the cross-route duplicate check while unassigned (no date to check against)", async () => {
    findRouteById.mockResolvedValue(route());
    findCenterById.mockResolvedValue({
      id: "center-1",
      territoryId: "territory-1",
      status: "ACTIVE",
    });

    await saveRouteContent("route-1", sel("center-1"), "creator-1", "SUPERVISOR");
    expect(findActiveCenterIdsForVisitorInRange).not.toHaveBeenCalled();
  });
});

describe("saveRouteContent — diffing against existing items", () => {
  it("removes a PENDING item no longer in the desired list", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()] }));

    await saveRouteContent("route-1", [], "creator-1", "SUPERVISOR");
    expect(deleteNonCompletedRouteItemContacts).toHaveBeenCalledWith("item-1", TX);
    expect(deleteRouteItem).toHaveBeenCalledWith("item-1", TX);
  });

  it("resequences a kept item instead of recreating it", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()] }));

    await saveRouteContent("route-1", sel("center-1"), "creator-1", "SUPERVISOR");
    expect(updateRouteItemSequence).toHaveBeenCalledWith("item-1", 0, "creator-1", TX);
    expect(createRouteItem).not.toHaveBeenCalled();
    expect(deleteRouteItem).not.toHaveBeenCalled();
  });

  it("creates new items only for centers not already on the route", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()] }));
    findCenterById.mockResolvedValue({
      id: "center-2",
      territoryId: "territory-1",
      status: "ACTIVE",
    });

    await saveRouteContent("route-1", sel("center-1", "center-2"), "creator-1", "SUPERVISOR");
    expect(updateRouteItemSequence).toHaveBeenCalledWith("item-1", 0, "creator-1", TX);
    expect(createRouteItem).toHaveBeenCalledWith(expect.objectContaining({ sequence: 1 }), TX);
  });

  it("never touches a COMPLETED or CANCELLED item even if it's left out of the desired list", async () => {
    findRouteById.mockResolvedValue(
      route({
        userId: "delegate-1",
        startDate: TOMORROW,
        endDate: TOMORROW,
        items: [item({ status: "COMPLETED" })],
      }),
    );

    await saveRouteContent("route-1", [], "delegate-1", "DELEGATE");
    expect(deleteRouteItem).not.toHaveBeenCalled();
  });
});

describe("reorderRouteItems", () => {
  it("is never gated by the edit cutoff, even on an assigned, already-started route", async () => {
    findRouteById.mockResolvedValue(
      route({ userId: "delegate-1", startDate: TODAY, endDate: TODAY }),
    );

    await reorderRouteItems("route-1", ["item-1"], "delegate-1", "DELEGATE");
    expect(updateRouteItemSequence).toHaveBeenCalledWith("item-1", 0, "delegate-1");
  });
});

describe("completeRouteItem / cancelRouteItem", () => {
  it("completeRouteItem rejects anyone but the visitor, even an in-chain supervisor", async () => {
    findRouteItemById.mockResolvedValue({
      id: "item-1",
      route: { userId: "delegate-1" },
      contacts: [],
    });

    await expect(completeRouteItem("item-1", "supervisor-1")).rejects.toThrow(RouteNotOwnedError);
  });

  it("cancelRouteItem rejects acting on a still-unassigned route's item (nothing to cancel yet)", async () => {
    findRouteItemById.mockResolvedValue({ id: "item-1", route: route(), contacts: [] });

    await expect(cancelRouteItem("item-1", "creator-1", "SUPERVISOR")).rejects.toThrow(
      RouteNotAuthorizedError,
    );
  });
});

const NEXT_WEEK = new Date("2026-06-22T00:00:00.000Z");

describe("assignRoute — first-time assignment", () => {
  it("assigns an unassigned route in place for the whole range, and records the history, in one transaction", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()], createdBy: "supervisor-1" }));
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await expect(
      assignRoute("route-1", "delegate-1", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).resolves.toBe("route-1");
    expect(assignRouteRow).toHaveBeenCalledWith(
      "route-1",
      "delegate-1",
      TOMORROW,
      NEXT_WEEK,
      "supervisor-1",
      TX,
    );
    expect(createRouteAssignmentRow).toHaveBeenCalledWith(
      {
        routeId: "route-1",
        action: "ASSIGNED",
        userId: "delegate-1",
        startDate: TOMORROW,
        endDate: NEXT_WEEK,
      },
      "supervisor-1",
      TX,
    );
    expect(createRouteRow).not.toHaveBeenCalled();
  });

  it("allows a range starting today", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()], createdBy: "supervisor-1" }));
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await expect(
      assignRoute("route-1", "delegate-1", TODAY, TOMORROW, "supervisor-1", "SUPERVISOR"),
    ).resolves.toBe("route-1");
  });

  it("refuses a route that is already assigned — never silently overwrites", async () => {
    findRouteById.mockResolvedValue(
      route({
        items: [item()],
        createdBy: "supervisor-1",
        userId: "delegate-1",
        startDate: TOMORROW,
        endDate: TOMORROW,
      }),
    );
    getDownstreamUserIds.mockResolvedValue(["delegate-1", "delegate-2"]);

    await expect(
      assignRoute("route-1", "delegate-2", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(RouteAlreadyAssignedError);
    expect(assignRouteRow).not.toHaveBeenCalled();
    expect(createRouteAssignmentRow).not.toHaveBeenCalled();
  });

  it("rejects assigning someone else's unassigned draft by id", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()], createdBy: "someone-else" }));
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await expect(
      assignRoute("route-1", "delegate-1", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(RouteNotAuthorizedError);
    expect(assignRouteRow).not.toHaveBeenCalled();
  });

  it("lets ADMIN assign anyone's draft to anyone", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()], createdBy: "someone-else" }));

    await expect(
      assignRoute("route-1", "delegate-1", TOMORROW, NEXT_WEEK, "admin-1", "ADMIN"),
    ).resolves.toBe("route-1");
  });

  it("rejects assigning to a target outside the actor's downstream chain", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()], createdBy: "supervisor-1" }));
    getDownstreamUserIds.mockResolvedValue([]);

    await expect(
      assignRoute("route-1", "someone-else", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(RouteNotAuthorizedError);
    expect(assignRouteRow).not.toHaveBeenCalled();
  });

  it("lets the actor assign a route to themselves", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()], createdBy: "supervisor-1" }));

    await expect(
      assignRoute("route-1", "supervisor-1", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).resolves.toBe("route-1");
  });

  it("rejects an inactive or missing assignee", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()], createdBy: "supervisor-1" }));
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    findUserById.mockResolvedValueOnce({ territoryId: null, status: "INACTIVE" });
    await expect(
      assignRoute("route-1", "delegate-1", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(AssigneeNotAssignableError);

    findUserById.mockResolvedValueOnce(null);
    await expect(
      assignRoute("route-1", "delegate-1", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(AssigneeNotAssignableError);
    expect(assignRouteRow).not.toHaveBeenCalled();
  });

  it("rejects a start date earlier than today (Kinshasa)", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()], createdBy: "supervisor-1" }));
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await expect(
      assignRoute("route-1", "delegate-1", YESTERDAY, TOMORROW, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(RouteStartInPastError);
  });

  it("uses the Kinshasa calendar day for 'today' — an hour before UTC midnight it is already tomorrow there", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()], createdBy: "supervisor-1" }));
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);
    // 23:30 UTC on the 15th is 00:30 on the 16th in Kinshasa (UTC+1).
    vi.setSystemTime(new Date("2026-06-15T23:30:00.000Z"));

    await expect(
      assignRoute("route-1", "delegate-1", TODAY, TOMORROW, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(RouteStartInPastError);
    await expect(
      assignRoute("route-1", "delegate-1", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).resolves.toBe("route-1");
  });

  it("rejects an end date before the start date", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()], createdBy: "supervisor-1" }));
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await expect(
      assignRoute("route-1", "delegate-1", NEXT_WEEK, TOMORROW, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(InvalidDateRangeError);
  });

  it("rejects a route with nothing pending to assign", async () => {
    findRouteById.mockResolvedValue(
      route({ items: [item({ status: "CANCELLED" })], createdBy: "supervisor-1" }),
    );
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await expect(
      assignRoute("route-1", "delegate-1", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(RouteHasNothingToAssignError);
  });

  it("validates every item's territory against the target before assigning", async () => {
    findRouteById.mockResolvedValue(
      route({
        createdBy: "supervisor-1",
        items: [item({ center: { id: "center-1", territoryId: "other-territory" } })],
      }),
    );
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await expect(
      assignRoute("route-1", "delegate-1", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(CenterOutsideTerritoryError);
    expect(assignRouteRow).not.toHaveBeenCalled();
  });

  it("blocks a center already planned for the target in an overlapping range, checked across the whole range", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()], createdBy: "supervisor-1" }));
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);
    findActiveCenterIdsForVisitorInRange.mockResolvedValue(new Set(["center-1"]));

    await expect(
      assignRoute("route-1", "delegate-1", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(DuplicateCenterOnRouteError);
    expect(findActiveCenterIdsForVisitorInRange).toHaveBeenCalledWith(
      "delegate-1",
      TOMORROW,
      NEXT_WEEK,
      "route-1",
    );
  });
});

describe("reassignRoute", () => {
  function assignedRoute(overrides: Record<string, unknown> = {}) {
    return route({
      id: "route-1",
      userId: "delegate-1",
      startDate: TOMORROW,
      endDate: TOMORROW,
      items: [item()],
      ...overrides,
    });
  }

  it("updates the same route in place — same id, no new route, nothing deleted — and records the history", async () => {
    findRouteById.mockResolvedValue(assignedRoute());
    getDownstreamUserIds.mockResolvedValue(["delegate-1", "delegate-2"]);

    const result = await reassignRoute(
      "route-1",
      "delegate-2",
      TOMORROW,
      NEXT_WEEK,
      "supervisor-1",
      "SUPERVISOR",
    );

    expect(result).toBe("route-1");
    expect(createRouteRow).not.toHaveBeenCalled();
    expect(deleteRouteItem).not.toHaveBeenCalled();
    expect(assignRouteRow).toHaveBeenCalledWith(
      "route-1",
      "delegate-2",
      TOMORROW,
      NEXT_WEEK,
      "supervisor-1",
      TX,
    );
    expect(createRouteAssignmentRow).toHaveBeenCalledWith(
      {
        routeId: "route-1",
        action: "REASSIGNED",
        userId: "delegate-2",
        startDate: TOMORROW,
        endDate: NEXT_WEEK,
      },
      "supervisor-1",
      TX,
    );
  });

  it("refuses a route nobody holds yet — that is an assignment, not a reassignment", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()], createdBy: "supervisor-1" }));

    await expect(
      reassignRoute("route-1", "delegate-1", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(RouteNotAssignedError);
  });

  it("refuses to reassign a route with any COMPLETED item", async () => {
    findRouteById.mockResolvedValue(
      assignedRoute({ items: [item({ status: "COMPLETED" }), item({ id: "item-2" })] }),
    );
    getDownstreamUserIds.mockResolvedValue(["delegate-1", "delegate-2"]);

    await expect(
      reassignRoute("route-1", "delegate-2", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(RouteHasCompletedItemsError);
    expect(assignRouteRow).not.toHaveBeenCalled();
    expect(createRouteAssignmentRow).not.toHaveBeenCalled();
  });

  it("still allows reassignment when the only non-pending items are cancelled", async () => {
    findRouteById.mockResolvedValue(
      assignedRoute({ items: [item({ status: "CANCELLED" }), item({ id: "item-2" })] }),
    );
    getDownstreamUserIds.mockResolvedValue(["delegate-1", "delegate-2"]);

    await expect(
      reassignRoute("route-1", "delegate-2", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).resolves.toBe("route-1");
  });

  it("rejects a route whose holder is outside the actor's downstream chain", async () => {
    findRouteById.mockResolvedValue(assignedRoute());
    getDownstreamUserIds.mockResolvedValue(["delegate-2"]);

    await expect(
      reassignRoute("route-1", "delegate-2", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(RouteNotAuthorizedError);
  });

  it("requires the new range to start no earlier than today and the new assignee to be active", async () => {
    findRouteById.mockResolvedValue(assignedRoute());
    getDownstreamUserIds.mockResolvedValue(["delegate-1", "delegate-2"]);

    await expect(
      reassignRoute("route-1", "delegate-2", YESTERDAY, TOMORROW, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(RouteStartInPastError);

    findUserById.mockResolvedValueOnce({ territoryId: null, status: "INACTIVE" });
    await expect(
      reassignRoute("route-1", "delegate-2", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(AssigneeNotAssignableError);
  });
});

describe("cancelRouteAssignment", () => {
  it("bulk-cancels every still-PENDING item and records a CANCELLED history row, authorized like any other route action", async () => {
    findRouteById.mockResolvedValue(
      route({ userId: "delegate-1", startDate: TOMORROW, endDate: NEXT_WEEK }),
    );
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await cancelRouteAssignment("route-1", "supervisor-1", "SUPERVISOR");
    expect(cancelPendingContactlessRouteItems).toHaveBeenCalledWith("route-1", "supervisor-1", TX);
    expect(createRouteAssignmentRow).toHaveBeenCalledWith(
      {
        routeId: "route-1",
        action: "CANCELLED",
        userId: "delegate-1",
        startDate: TOMORROW,
        endDate: NEXT_WEEK,
      },
      "supervisor-1",
      TX,
    );
  });

  it("does nothing for a still-unassigned route", async () => {
    findRouteById.mockResolvedValue(route());

    await cancelRouteAssignment("route-1", "creator-1", "SUPERVISOR");
    expect(cancelPendingContactlessRouteItems).not.toHaveBeenCalled();
    expect(cancelPendingContactsOnRoute).not.toHaveBeenCalled();
    expect(createRouteAssignmentRow).not.toHaveBeenCalled();
  });
});

describe("getRoutesForContent / getMyVisits — MISSED is computed, never stored", () => {
  it("displays a PENDING item as MISSED once its route date has passed", async () => {
    findEditableRoutes.mockResolvedValue([
      route({ userId: "delegate-1", startDate: YESTERDAY, endDate: YESTERDAY, items: [item()] }),
    ]);

    const result = await getRoutesForContent("supervisor-1", "SUPERVISOR");
    expect(result[0]?.items[0]?.status).toBe("MISSED");
  });

  it("keeps a PENDING item as PENDING for a future date", async () => {
    findRoutesForVisitor.mockResolvedValue([
      route({ userId: "delegate-1", startDate: TOMORROW, endDate: TOMORROW, items: [item()] }),
    ]);

    const result = await getMyVisits("delegate-1");
    expect(result[0]?.items[0]?.status).toBe("PENDING");
  });

  it("never relabels a COMPLETED item as MISSED, even for a past date", async () => {
    findRoutesForVisitor.mockResolvedValue([
      route({
        userId: "delegate-1",
        startDate: YESTERDAY,
        endDate: YESTERDAY,
        items: [item({ status: "COMPLETED" })],
      }),
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

// ---------------------------------------------------------------------------
// Contacts under centers
// ---------------------------------------------------------------------------

describe("deriveCenterStatus", () => {
  it("has no derived status when there are no contacts (center stays manual)", () => {
    expect(deriveCenterStatus([])).toBeNull();
  });

  it("stays PENDING while any contact is still PENDING, even if others are done", () => {
    expect(deriveCenterStatus(["COMPLETED", "PENDING", "CANCELLED"])).toBe("PENDING");
  });

  it("is COMPLETED once none are PENDING and at least one is COMPLETED", () => {
    expect(deriveCenterStatus(["COMPLETED", "CANCELLED"])).toBe("COMPLETED");
    expect(deriveCenterStatus(["COMPLETED"])).toBe("COMPLETED");
  });

  it("is CANCELLED only when every contact is CANCELLED", () => {
    expect(deriveCenterStatus(["CANCELLED", "CANCELLED"])).toBe("CANCELLED");
  });
});

describe("saveRouteContent — contacts", () => {
  const activeCenter = (id = "center-1", territoryId = "territory-1") => ({
    id,
    territoryId,
    status: "ACTIVE",
  });

  it("saves several contacts for one center in a single operation", async () => {
    findCenterById.mockResolvedValue(activeCenter());
    findCenterContactLinks.mockResolvedValue([link("center-1", "c1"), link("center-1", "c2")]);

    await saveRouteContent(
      null,
      [{ centerId: "center-1", contactIds: ["c1", "c2"] }],
      "creator-1",
      "SUPERVISOR",
    );
    expect(createRouteItemContacts).toHaveBeenCalledWith("item-1", ["c1", "c2"], "creator-1", TX);
  });

  it("saves several centers, each with its own independent contacts", async () => {
    findCenterById.mockImplementation(async (id: string) => activeCenter(id));
    createRouteItem.mockResolvedValueOnce({ id: "item-a" }).mockResolvedValueOnce({ id: "item-b" });
    // The same contact is legitimately selected under two different centers.
    findCenterContactLinks.mockResolvedValue([
      link("center-1", "c1"),
      link("center-2", "c1"),
      link("center-2", "c2"),
    ]);

    await saveRouteContent(
      null,
      [
        { centerId: "center-1", contactIds: ["c1"] },
        { centerId: "center-2", contactIds: ["c1", "c2"] },
      ],
      "creator-1",
      "SUPERVISOR",
    );
    expect(createRouteItemContacts).toHaveBeenCalledWith("item-a", ["c1"], "creator-1", TX);
    expect(createRouteItemContacts).toHaveBeenCalledWith("item-b", ["c1", "c2"], "creator-1", TX);
  });

  it("allows a center with no contacts at all", async () => {
    findCenterById.mockResolvedValue(activeCenter());

    await saveRouteContent(null, sel("center-1"), "creator-1", "SUPERVISOR");
    expect(createRouteItemContacts).not.toHaveBeenCalled();
    expect(findCenterContactLinks).not.toHaveBeenCalled();
  });

  it("validates every contact against its own center in one query", async () => {
    findCenterById.mockResolvedValue(activeCenter());
    findCenterContactLinks.mockResolvedValue([link("center-1", "c1")]);

    await saveRouteContent(
      null,
      [{ centerId: "center-1", contactIds: ["c1"] }],
      "creator-1",
      "SUPERVISOR",
    );
    expect(findCenterContactLinks).toHaveBeenCalledTimes(1);
    expect(findCenterContactLinks).toHaveBeenCalledWith(["center-1"], ["c1"]);
  });

  it("rejects a contact that isn't linked to the center it was selected under, writing nothing", async () => {
    findCenterById.mockResolvedValue(activeCenter());
    // c1 belongs to center-2 only, not center-1.
    findCenterContactLinks.mockResolvedValue([link("center-2", "c1")]);

    await expect(
      saveRouteContent(
        null,
        [{ centerId: "center-1", contactIds: ["c1"] }],
        "creator-1",
        "SUPERVISOR",
      ),
    ).rejects.toThrow(InvalidCenterContactError);
    expect(runInTransaction).not.toHaveBeenCalled();
    expect(createRouteRow).not.toHaveBeenCalled();
  });

  it("rejects an inactive contact", async () => {
    findCenterById.mockResolvedValue(activeCenter());
    findCenterContactLinks.mockResolvedValue([link("center-1", "c1", "INACTIVE")]);

    await expect(
      saveRouteContent(
        null,
        [{ centerId: "center-1", contactIds: ["c1"] }],
        "creator-1",
        "SUPERVISOR",
      ),
    ).rejects.toThrow(InvalidCenterContactError);
  });

  it("rejects an inactive center", async () => {
    findCenterById.mockResolvedValue({ ...activeCenter(), status: "INACTIVE" });

    await expect(
      saveRouteContent(null, sel("center-1"), "creator-1", "SUPERVISOR"),
    ).rejects.toThrow(InactiveCenterError);
  });

  it("rejects a center listed twice", async () => {
    await expect(
      saveRouteContent(null, sel("center-1", "center-1"), "creator-1", "SUPERVISOR"),
    ).rejects.toThrow(CenterAlreadyOnRouteError);
  });

  it("rejects re-adding a center whose visit already has a final status", async () => {
    findRouteById.mockResolvedValue(route({ items: [item({ status: "COMPLETED" })] }));

    await expect(
      saveRouteContent("route-1", sel("center-1"), "creator-1", "SUPERVISOR"),
    ).rejects.toThrow(CenterAlreadyOnRouteError);
  });

  it("adds more contacts to an already-selected center without touching the existing ones", async () => {
    findRouteById.mockResolvedValue(route({ items: [item({ contacts: [contactRow()] })] }));
    findCenterContactLinks.mockResolvedValue([
      link("center-1", "contact-1"),
      link("center-1", "c2"),
    ]);

    await saveRouteContent(
      "route-1",
      [{ centerId: "center-1", contactIds: ["contact-1", "c2"] }],
      "creator-1",
      "SUPERVISOR",
    );
    expect(createRouteItemContacts).toHaveBeenCalledWith("item-1", ["c2"], "creator-1", TX);
    expect(deletePendingRouteItemContacts).not.toHaveBeenCalled();
    // Contacts changed, so the center's derived status is re-synced in the same transaction.
    expect(listContactStatusesForItem).toHaveBeenCalledWith("item-1", TX);
  });

  it("removes a pending contact that is no longer selected", async () => {
    findRouteById.mockResolvedValue(route({ items: [item({ contacts: [contactRow()] })] }));

    await saveRouteContent("route-1", sel("center-1"), "creator-1", "SUPERVISOR");
    expect(deletePendingRouteItemContacts).toHaveBeenCalledWith("item-1", ["contact-1"], TX);
  });

  it("refuses to save a kept pending contact whose center link has since been removed", async () => {
    findRouteById.mockResolvedValue(route({ items: [item({ contacts: [contactRow()] })] }));
    findCenterContactLinks.mockResolvedValue([]);

    await expect(
      saveRouteContent(
        "route-1",
        [{ centerId: "center-1", contactIds: ["contact-1"] }],
        "creator-1",
        "SUPERVISOR",
      ),
    ).rejects.toThrow(InvalidCenterContactError);
    expect(runInTransaction).not.toHaveBeenCalled();
  });

  it("never revalidates or deletes a COMPLETED contact, even if its link is gone", async () => {
    findRouteById.mockResolvedValue(
      route({
        items: [
          item({
            contacts: [
              contactRow({ id: "rc-done", contactId: "done", status: "COMPLETED" }),
              contactRow({ id: "rc-open", contactId: "open" }),
            ],
          }),
        ],
      }),
    );
    findCenterContactLinks.mockResolvedValue([link("center-1", "open")]);

    await saveRouteContent(
      "route-1",
      [{ centerId: "center-1", contactIds: ["open"] }],
      "creator-1",
      "SUPERVISOR",
    );
    expect(deletePendingRouteItemContacts).not.toHaveBeenCalled();
  });

  it("rejects re-selecting a contact that already has a final status on that center", async () => {
    findRouteById.mockResolvedValue(
      route({ items: [item({ contacts: [contactRow({ status: "CANCELLED" })] })] }),
    );

    await expect(
      saveRouteContent(
        "route-1",
        [{ centerId: "center-1", contactIds: ["contact-1"] }],
        "creator-1",
        "SUPERVISOR",
      ),
    ).rejects.toThrow(ContactAlreadyOnRouteError);
  });

  it("refuses to remove a center that has a COMPLETED contact", async () => {
    findRouteById.mockResolvedValue(
      route({ items: [item({ contacts: [contactRow({ status: "COMPLETED" })] })] }),
    );

    await expect(saveRouteContent("route-1", [], "creator-1", "SUPERVISOR")).rejects.toThrow(
      RouteItemHasCompletedContactsError,
    );
    expect(deleteRouteItem).not.toHaveBeenCalled();
  });

  it("still enforces territory eligibility for a new center that has contacts", async () => {
    findCenterById.mockResolvedValue(activeCenter("center-1", "outside"));

    await expect(
      saveRouteContent(
        null,
        [{ centerId: "center-1", contactIds: ["c1"] }],
        "creator-1",
        "SUPERVISOR",
      ),
    ).rejects.toThrow(CenterOutsideTerritoryError);
  });

  it("writes everything inside one transaction", async () => {
    findCenterById.mockResolvedValue(activeCenter());
    findCenterContactLinks.mockResolvedValue([link("center-1", "c1")]);

    await saveRouteContent(
      null,
      [{ centerId: "center-1", contactIds: ["c1"] }],
      "creator-1",
      "SUPERVISOR",
    );
    expect(runInTransaction).toHaveBeenCalledTimes(1);
  });
});

describe("completeRouteItem / cancelRouteItem — centers with contacts", () => {
  it("won't complete a center that has contacts directly", async () => {
    findRouteItemById.mockResolvedValue({
      id: "item-1",
      route: { userId: "delegate-1" },
      contacts: [contactRow()],
    });

    await expect(completeRouteItem("item-1", "delegate-1")).rejects.toThrow(
      CenterStatusDerivedError,
    );
    expect(updateRouteItemStatus).not.toHaveBeenCalled();
  });

  it("cancelling a center cancels its pending contacts and derives the center from what's left", async () => {
    findRouteItemById.mockResolvedValue({
      id: "item-1",
      route: route({ userId: "delegate-1", startDate: TOMORROW, endDate: TOMORROW }),
      contacts: [contactRow({ status: "COMPLETED" }), contactRow({ id: "rc-2" })],
    });
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);
    // After cancelling the pending one: one COMPLETED + one CANCELLED.
    listContactStatusesForItem.mockResolvedValue(["COMPLETED", "CANCELLED"]);

    await cancelRouteItem("item-1", "supervisor-1", "SUPERVISOR");
    expect(cancelPendingContactsOnItem).toHaveBeenCalledWith("item-1", "supervisor-1", TX);
    // The completed contact is untouched, so the center ends COMPLETED, never contradicting it.
    expect(updateRouteItemStatus).toHaveBeenCalledWith("item-1", "COMPLETED", "supervisor-1", TX);
  });

  it("cancelling a center whose contacts are all pending ends CANCELLED", async () => {
    findRouteItemById.mockResolvedValue({
      id: "item-1",
      route: route({ userId: "delegate-1", startDate: TOMORROW, endDate: TOMORROW }),
      contacts: [contactRow()],
    });
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);
    listContactStatusesForItem.mockResolvedValue(["CANCELLED"]);

    await cancelRouteItem("item-1", "supervisor-1", "SUPERVISOR");
    expect(updateRouteItemStatus).toHaveBeenCalledWith("item-1", "CANCELLED", "supervisor-1", TX);
  });

  it("a center with no contacts is still cancelled manually, as before", async () => {
    findRouteItemById.mockResolvedValue({
      id: "item-1",
      route: route({ userId: "delegate-1", startDate: TOMORROW, endDate: TOMORROW }),
      contacts: [],
    });
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await cancelRouteItem("item-1", "supervisor-1", "SUPERVISOR");
    expect(cancelPendingContactsOnItem).not.toHaveBeenCalled();
    expect(updateRouteItemStatus).toHaveBeenCalledWith("item-1", "CANCELLED", "supervisor-1");
  });
});

describe("completeRouteItemContact / cancelRouteItemContact", () => {
  function contactWithRoute(overrides: Record<string, unknown> = {}, routeOverrides = {}) {
    return contactRow({
      routeItem: {
        id: "item-1",
        route: route({
          userId: "delegate-1",
          startDate: TOMORROW,
          endDate: TOMORROW,
          ...routeOverrides,
        }),
      },
      ...overrides,
    });
  }

  it("only the visitor can complete a contact, not even an in-chain supervisor", async () => {
    findRouteItemContactById.mockResolvedValue(contactWithRoute());

    await expect(completeRouteItemContact("rc-1", "supervisor-1")).rejects.toThrow(
      RouteNotOwnedError,
    );
  });

  it("completing the last pending contact completes the center", async () => {
    findRouteItemContactById.mockResolvedValue(contactWithRoute());
    listContactStatusesForItem.mockResolvedValue(["COMPLETED", "CANCELLED"]);

    await completeRouteItemContact("rc-1", "delegate-1");
    expect(updateRouteItemContactStatus).toHaveBeenCalledWith(
      "rc-1",
      "COMPLETED",
      "delegate-1",
      TX,
    );
    expect(updateRouteItemStatus).toHaveBeenCalledWith("item-1", "COMPLETED", "delegate-1", TX);
  });

  it("completing one contact while another is still pending keeps the center PENDING", async () => {
    findRouteItemContactById.mockResolvedValue(contactWithRoute());
    listContactStatusesForItem.mockResolvedValue(["COMPLETED", "PENDING"]);

    await completeRouteItemContact("rc-1", "delegate-1");
    expect(updateRouteItemStatus).toHaveBeenCalledWith("item-1", "PENDING", "delegate-1", TX);
  });

  it("completes a MISSED (late) contact like any pending one — it is never terminal", async () => {
    findRouteItemContactById.mockResolvedValue(
      contactWithRoute({}, { startDate: YESTERDAY, endDate: YESTERDAY }),
    );
    listContactStatusesForItem.mockResolvedValue(["COMPLETED"]);

    await completeRouteItemContact("rc-1", "delegate-1");
    expect(updateRouteItemContactStatus).toHaveBeenCalled();
  });

  it("won't complete a cancelled contact", async () => {
    findRouteItemContactById.mockResolvedValue(contactWithRoute({ status: "CANCELLED" }));

    await expect(completeRouteItemContact("rc-1", "delegate-1")).rejects.toThrow(
      ContactStatusConflictError,
    );
  });

  it("won't cancel a completed contact", async () => {
    findRouteItemContactById.mockResolvedValue(contactWithRoute({ status: "COMPLETED" }));
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await expect(cancelRouteItemContact("rc-1", "supervisor-1", "SUPERVISOR")).rejects.toThrow(
      ContactStatusConflictError,
    );
    expect(updateRouteItemContactStatus).not.toHaveBeenCalled();
  });

  it("cancelling every contact cancels the center", async () => {
    findRouteItemContactById.mockResolvedValue(contactWithRoute());
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);
    listContactStatusesForItem.mockResolvedValue(["CANCELLED", "CANCELLED"]);

    await cancelRouteItemContact("rc-1", "supervisor-1", "SUPERVISOR");
    expect(updateRouteItemStatus).toHaveBeenCalledWith("item-1", "CANCELLED", "supervisor-1", TX);
  });

  it("rejects cancelling on a still-unassigned route", async () => {
    findRouteItemContactById.mockResolvedValue(
      contactWithRoute({}, { userId: null, startDate: null, endDate: null }),
    );

    await expect(cancelRouteItemContact("rc-1", "creator-1", "SUPERVISOR")).rejects.toThrow(
      RouteNotAuthorizedError,
    );
  });

  it("rejects cancelling for someone outside the actor's downstream chain", async () => {
    findRouteItemContactById.mockResolvedValue(contactWithRoute());
    getDownstreamUserIds.mockResolvedValue([]);

    await expect(cancelRouteItemContact("rc-1", "supervisor-1", "SUPERVISOR")).rejects.toThrow(
      RouteNotAuthorizedError,
    );
  });
});

describe("assignRoute / cancelRouteAssignment — contacts", () => {
  it("refuses to reassign when a contact is COMPLETED even though the center is still PENDING", async () => {
    findRouteById.mockResolvedValue(
      route({
        id: "old-route",
        userId: "delegate-1",
        startDate: TOMORROW,
        endDate: TOMORROW,
        items: [item({ status: "PENDING", contacts: [contactRow({ status: "COMPLETED" })] })],
      }),
    );
    getDownstreamUserIds.mockResolvedValue(["delegate-1", "delegate-2"]);

    await expect(
      reassignRoute("old-route", "delegate-2", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(RouteHasCompletedItemsError);
    expect(assignRouteRow).not.toHaveBeenCalled();
  });

  it("cancelling an assignment cancels pending contacts too, then re-derives each center that has contacts", async () => {
    findRouteById.mockResolvedValue(
      route({ userId: "delegate-1", startDate: TOMORROW, endDate: TOMORROW }),
    );
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);
    listPendingItemIdsWithContacts.mockResolvedValue(["item-1", "item-2"]);
    listContactStatusesForItem.mockResolvedValueOnce(["COMPLETED", "CANCELLED"]);
    listContactStatusesForItem.mockResolvedValueOnce(["CANCELLED"]);

    await cancelRouteAssignment("route-1", "supervisor-1", "SUPERVISOR");
    expect(cancelPendingContactsOnRoute).toHaveBeenCalledWith("route-1", "supervisor-1", TX);
    expect(cancelPendingContactlessRouteItems).toHaveBeenCalledWith("route-1", "supervisor-1", TX);
    expect(updateRouteItemStatus).toHaveBeenCalledWith("item-1", "COMPLETED", "supervisor-1", TX);
    expect(updateRouteItemStatus).toHaveBeenCalledWith("item-2", "CANCELLED", "supervisor-1", TX);
  });
});

describe("route summaries — contacts", () => {
  it("flags a saved contact whose center link was removed, but keeps it listed", async () => {
    findEditableRoutes.mockResolvedValue([route({ items: [item({ contacts: [contactRow()] })] })]);
    findCenterContactLinks.mockResolvedValue([]);

    const result = await getRoutesForContent("creator-1", "SUPERVISOR");
    expect(result[0]?.items[0]?.contacts[0]).toMatchObject({
      contactId: "contact-1",
      issue: "NOT_ASSOCIATED",
    });
  });

  it("flags an inactive contact and leaves a healthy one unflagged", async () => {
    findEditableRoutes.mockResolvedValue([
      route({
        items: [
          item({
            contacts: [
              contactRow({
                contactId: "ok",
                contact: { id: "ok", name: "A", code: "A", status: "ACTIVE" },
              }),
              contactRow({
                id: "rc-2",
                contactId: "off",
                contact: { id: "off", name: "B", code: "B", status: "INACTIVE" },
              }),
            ],
          }),
        ],
      }),
    ]);
    findCenterContactLinks.mockResolvedValue([link("center-1", "ok"), link("center-1", "off")]);

    const contacts = (await getRoutesForContent("creator-1", "SUPERVISOR"))[0]!.items[0]!.contacts;
    expect(contacts.find((c) => c.contactId === "ok")?.issue).toBeNull();
    expect(contacts.find((c) => c.contactId === "off")?.issue).toBe("INACTIVE");
  });

  it("looks up every center–contact link in one query, not one per center", async () => {
    const centerOf = (id: string) => ({
      id,
      territoryId: "t",
      name: id,
      code: id,
      type: { name: "Hospital" },
    });
    findEditableRoutes.mockResolvedValue([
      route({
        items: [
          item({ id: "i1", center: centerOf("center-1"), contacts: [contactRow()] }),
          item({
            id: "i2",
            center: centerOf("center-2"),
            contacts: [contactRow({ id: "rc-2", contactId: "c2" })],
          }),
        ],
      }),
    ]);

    await getRoutesForContent("creator-1", "SUPERVISOR");
    expect(findCenterContactLinks).toHaveBeenCalledTimes(1);
  });

  it("computes MISSED for a pending contact past the route's date, never for a completed one", async () => {
    findRoutesForVisitor.mockResolvedValue([
      route({
        userId: "delegate-1",
        startDate: YESTERDAY,
        endDate: YESTERDAY,
        items: [
          item({
            contacts: [
              contactRow(),
              contactRow({ id: "rc-2", contactId: "c2", status: "COMPLETED" }),
            ],
          }),
        ],
      }),
    ]);
    findCenterContactLinks.mockResolvedValue([
      link("center-1", "contact-1"),
      link("center-1", "c2"),
    ]);

    const contacts = (await getMyVisits("delegate-1"))[0]!.items[0]!.contacts;
    expect(contacts.map((c) => c.status)).toEqual(["MISSED", "COMPLETED"]);
  });
});

describe("searchCentersForRoute", () => {
  it("searches only the actor's permitted territories on a new route", async () => {
    searchActiveCentersInTerritories.mockResolvedValue([]);

    await searchCentersForRoute({ q: "ab", limit: 20 }, "creator-1", "SUPERVISOR");
    expect(searchActiveCentersInTerritories).toHaveBeenCalledWith({
      territoryIds: ["territory-1"],
      q: "ab",
      limit: 20,
    });
  });

  it("narrows to the chosen territory when it is permitted", async () => {
    listAssignmentsForUser.mockResolvedValue([{ territoryId: "t1" }, { territoryId: "t2" }]);
    searchActiveCentersInTerritories.mockResolvedValue([]);

    await searchCentersForRoute({ q: "", territoryId: "t2", limit: 20 }, "creator-1", "SUPERVISOR");
    expect(searchActiveCentersInTerritories).toHaveBeenCalledWith(
      expect.objectContaining({ territoryIds: ["t2"] }),
    );
  });

  it("returns nothing, without querying, for a territory outside the actor's reach", async () => {
    const result = await searchCentersForRoute(
      { q: "", territoryId: "elsewhere", limit: 20 },
      "creator-1",
      "SUPERVISOR",
    );
    expect(result).toEqual([]);
    expect(searchActiveCentersInTerritories).not.toHaveBeenCalled();
  });

  it("scopes to the route's visitor when editing an assigned route, after authorizing the actor", async () => {
    findRouteById.mockResolvedValue(
      route({ userId: "delegate-1", startDate: TOMORROW, endDate: TOMORROW }),
    );
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);
    listAssignmentsForUser.mockResolvedValue([{ territoryId: "delegate-territory" }]);
    searchActiveCentersInTerritories.mockResolvedValue([]);

    await searchCentersForRoute(
      { q: "", routeId: "route-1", limit: 20 },
      "supervisor-1",
      "SUPERVISOR",
    );
    expect(listAssignmentsForUser).toHaveBeenCalledWith("delegate-1");
    expect(searchActiveCentersInTerritories).toHaveBeenCalledWith(
      expect.objectContaining({ territoryIds: ["delegate-territory"] }),
    );
  });

  it("rejects a route the actor can't act on", async () => {
    findRouteById.mockResolvedValue(
      route({ userId: "delegate-1", startDate: TOMORROW, endDate: TOMORROW }),
    );
    getDownstreamUserIds.mockResolvedValue([]);

    await expect(
      searchCentersForRoute({ q: "", routeId: "route-1", limit: 20 }, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(RouteNotAuthorizedError);
  });
});

describe("searchContactsForRouteCenter", () => {
  it("queries only the one requested center's contacts", async () => {
    findCenterById.mockResolvedValue({
      id: "center-1",
      territoryId: "territory-1",
      status: "ACTIVE",
    });
    searchContactsForCenter.mockResolvedValue([
      {
        contact: { id: "c1", name: "Dr One", code: "CON-00001" },
        roleAtCenter: { name: "Doctor" },
      },
    ]);

    const result = await searchContactsForRouteCenter(
      "center-1",
      { q: "dr", limit: 20 },
      "creator-1",
      "SUPERVISOR",
    );
    expect(searchContactsForCenter).toHaveBeenCalledWith({
      centerId: "center-1",
      q: "dr",
      limit: 20,
    });
    expect(result).toEqual([{ id: "c1", name: "Dr One", code: "CON-00001", roleName: "Doctor" }]);
  });

  it("rejects a center outside the actor's territories without searching", async () => {
    findCenterById.mockResolvedValue({ id: "center-1", territoryId: "outside", status: "ACTIVE" });

    await expect(
      searchContactsForRouteCenter("center-1", { q: "", limit: 20 }, "creator-1", "SUPERVISOR"),
    ).rejects.toThrow(CenterOutsideTerritoryError);
    expect(searchContactsForCenter).not.toHaveBeenCalled();
  });

  it("rejects an unknown or inactive center", async () => {
    findCenterById.mockResolvedValue(null);
    await expect(
      searchContactsForRouteCenter("nope", { q: "", limit: 20 }, "creator-1", "SUPERVISOR"),
    ).rejects.toThrow(CenterNotFoundError);

    findCenterById.mockResolvedValue({
      id: "center-1",
      territoryId: "territory-1",
      status: "INACTIVE",
    });
    await expect(
      searchContactsForRouteCenter("center-1", { q: "", limit: 20 }, "creator-1", "SUPERVISOR"),
    ).rejects.toThrow(InactiveCenterError);
  });
});

// ---------------------------------------------------------------------------
// Route status, the Assign Routes table, Home and the assign-form searches
// ---------------------------------------------------------------------------

describe("deriveRouteStatus", () => {
  const assigned = { userId: "delegate-1", endDate: NEXT_WEEK };

  it("is UNASSIGNED while nobody holds the route", () => {
    expect(deriveRouteStatus({ userId: null, endDate: null }, ["PENDING"])).toBe("UNASSIGNED");
  });

  it("is ASSIGNED while everything is pending and the range isn't over", () => {
    expect(deriveRouteStatus(assigned, ["PENDING", "PENDING"])).toBe("ASSIGNED");
  });

  it("is IN_PROGRESS with some completed and some pending", () => {
    expect(deriveRouteStatus(assigned, ["COMPLETED", "PENDING"])).toBe("IN_PROGRESS");
  });

  it("is COMPLETED once nothing is pending and something was completed", () => {
    expect(deriveRouteStatus(assigned, ["COMPLETED", "CANCELLED"])).toBe("COMPLETED");
  });

  it("is CANCELLED only when everything is cancelled", () => {
    expect(deriveRouteStatus(assigned, ["CANCELLED", "CANCELLED"])).toBe("CANCELLED");
  });

  it("is MISSED when something is still pending after the range ended", () => {
    expect(deriveRouteStatus({ userId: "d", endDate: YESTERDAY }, ["PENDING"])).toBe("MISSED");
    expect(deriveRouteStatus({ userId: "d", endDate: YESTERDAY }, ["COMPLETED", "PENDING"])).toBe(
      "MISSED",
    );
  });

  it("is not MISSED on the last day of the range", () => {
    expect(deriveRouteStatus({ userId: "d", endDate: TODAY }, ["PENDING"])).toBe("ASSIGNED");
  });

  it("never reads a finished route as MISSED, however old", () => {
    expect(deriveRouteStatus({ userId: "d", endDate: YESTERDAY }, ["COMPLETED"])).toBe("COMPLETED");
  });

  it("treats an assigned route with no items as ASSIGNED", () => {
    expect(deriveRouteStatus(assigned, [])).toBe("ASSIGNED");
  });
});

describe("listRoutesForAssignment", () => {
  const filters = { page: 2, pageSize: 20 };

  it("applies the actor's scope on the server and pages with skip/take", async () => {
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);
    findRoutesPage.mockResolvedValue({ routes: [], total: 45 });

    const result = await listRoutesForAssignment(filters, "supervisor-1", "SUPERVISOR");
    expect(findRoutesPage).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { creatorId: "supervisor-1", assignedUserIds: ["delegate-1"] },
        skip: 20,
        take: 20,
      }),
    );
    expect(result).toMatchObject({ total: 45, page: 2, pageSize: 20 });
  });

  it("gives ADMIN no scope restriction", async () => {
    findRoutesPage.mockResolvedValue({ routes: [], total: 0 });

    await listRoutesForAssignment({ page: 1, pageSize: 20 }, "admin-1", "ADMIN");
    expect(findRoutesPage).toHaveBeenCalledWith(
      expect.objectContaining({ scope: { creatorId: "admin-1", assignedUserIds: undefined } }),
    );
    expect(getDownstreamUserIds).not.toHaveBeenCalled();
  });

  it("passes the filters through, with dates parsed and 'today' in Kinshasa", async () => {
    getDownstreamUserIds.mockResolvedValue([]);
    findRoutesPage.mockResolvedValue({ routes: [], total: 0 });

    await listRoutesForAssignment(
      {
        page: 1,
        pageSize: 20,
        q: "RT-0",
        assigneeId: "u1",
        status: "MISSED",
        from: "2026-06-16",
        to: "2026-06-30",
      },
      "supervisor-1",
      "SUPERVISOR",
    );
    expect(findRoutesPage).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: {
          q: "RT-0",
          assigneeId: "u1",
          status: "MISSED",
          from: new Date("2026-06-16T00:00:00.000Z"),
          to: new Date("2026-06-30T00:00:00.000Z"),
        },
        today: TODAY,
      }),
    );
  });

  it("returns summaries with the derived status, code and range", async () => {
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);
    findRoutesPage.mockResolvedValue({
      routes: [
        route({
          userId: "delegate-1",
          startDate: TOMORROW,
          endDate: NEXT_WEEK,
          items: [item({ status: "COMPLETED" }), item({ id: "item-2" })],
        }),
      ],
      total: 1,
    });

    const { items } = await listRoutesForAssignment(
      { page: 1, pageSize: 20 },
      "supervisor-1",
      "SUPERVISOR",
    );
    expect(items[0]).toMatchObject({
      code: "RT-00001",
      status: "IN_PROGRESS",
      startDate: TOMORROW,
      endDate: NEXT_WEEK,
    });
  });
});

describe("getRouteForManagement", () => {
  it("returns the route for someone who may act on it", async () => {
    findRouteById.mockResolvedValue(route({ createdBy: "supervisor-1", items: [item()] }));

    const result = await getRouteForManagement("route-1", "supervisor-1", "SUPERVISOR");
    expect(result?.id).toBe("route-1");
  });

  it("returns null — same as not found — for a route the actor can't act on", async () => {
    findRouteById.mockResolvedValue(route({ createdBy: "someone-else" }));

    await expect(
      getRouteForManagement("route-1", "supervisor-1", "SUPERVISOR"),
    ).resolves.toBeNull();
    findRouteById.mockResolvedValue(null);
    await expect(getRouteForManagement("nope", "supervisor-1", "SUPERVISOR")).resolves.toBeNull();
  });
});

describe("getMyRoutesForHome", () => {
  // TODAY = Monday 2026-06-15 -> this week 15–21 June, upcoming 22–28 June.
  const MON_THIS = new Date("2026-06-15T00:00:00.000Z");
  const SUN_THIS = new Date("2026-06-21T00:00:00.000Z");
  const MON_NEXT = new Date("2026-06-22T00:00:00.000Z");
  const SUN_NEXT = new Date("2026-06-28T00:00:00.000Z");
  const mine = (overrides: Record<string, unknown>) =>
    route({ userId: "delegate-1", items: [item()], ...overrides });

  it("asks only for the signed-in user's own routes, across this week and the next", async () => {
    findRoutesForVisitorOverlapping.mockResolvedValue([]);

    await getMyRoutesForHome("delegate-1");
    expect(findRoutesForVisitorOverlapping).toHaveBeenCalledWith("delegate-1", MON_THIS, SUN_NEXT);
  });

  it("places a route in the week(s) its range overlaps", async () => {
    findRoutesForVisitorOverlapping.mockResolvedValue([
      mine({ id: "now", startDate: MON_THIS, endDate: SUN_THIS }),
      mine({ id: "later", startDate: MON_NEXT, endDate: SUN_NEXT }),
    ]);

    const home = await getMyRoutesForHome("delegate-1");
    expect(home.thisWeek.routes.map((r) => r.id)).toEqual(["now"]);
    expect(home.upcomingWeek.routes.map((r) => r.id)).toEqual(["later"]);
    expect(home.thisWeek.range).toEqual({ start: MON_THIS, end: SUN_THIS });
    expect(home.upcomingWeek.range).toEqual({ start: MON_NEXT, end: SUN_NEXT });
  });

  it("shows a route spanning both weeks once per section — whole, as one assignment", async () => {
    findRoutesForVisitorOverlapping.mockResolvedValue([
      mine({
        id: "spans",
        startDate: new Date("2026-06-19T00:00:00.000Z"),
        endDate: new Date("2026-06-24T00:00:00.000Z"),
        items: [
          item({ id: "i1", contacts: [contactRow()] }),
          item({
            id: "i2",
            center: { id: "center-2", territoryId: "t", name: "B", code: "B", type: { name: "H" } },
          }),
        ],
      }),
    ]);
    findCenterContactLinks.mockResolvedValue([link("center-1", "contact-1")]);

    const home = await getMyRoutesForHome("delegate-1");
    expect(home.thisWeek.routes).toHaveLength(1);
    expect(home.upcomingWeek.routes).toHaveLength(1);
    // Same route in both, every center and contact intact — not split by week.
    expect(home.thisWeek.routes[0]?.items).toHaveLength(2);
    expect(home.upcomingWeek.routes[0]?.items).toHaveLength(2);
    expect(home.upcomingWeek.routes[0]?.items[0]?.contacts).toHaveLength(1);
    expect(home.thisWeek.routes[0]?.id).toBe(home.upcomingWeek.routes[0]?.id);
  });

  it("counts a range that only touches a week on its boundary day", async () => {
    findRoutesForVisitorOverlapping.mockResolvedValue([
      mine({ id: "ends-sun", startDate: new Date("2026-06-10T00:00:00.000Z"), endDate: MON_THIS }),
      mine({
        id: "starts-sun",
        startDate: SUN_THIS,
        endDate: new Date("2026-06-30T00:00:00.000Z"),
      }),
    ]);

    const home = await getMyRoutesForHome("delegate-1");
    expect(home.thisWeek.routes.map((r) => r.id)).toEqual(["ends-sun", "starts-sun"]);
    expect(home.upcomingWeek.routes.map((r) => r.id)).toEqual(["starts-sun"]);
  });

  it("leaves cancelled routes out but keeps completed ones while their range overlaps", async () => {
    findRoutesForVisitorOverlapping.mockResolvedValue([
      mine({
        id: "cancelled",
        startDate: MON_THIS,
        endDate: SUN_THIS,
        items: [item({ status: "CANCELLED" })],
      }),
      mine({
        id: "done",
        startDate: MON_THIS,
        endDate: SUN_THIS,
        items: [item({ status: "COMPLETED" })],
      }),
    ]);

    const home = await getMyRoutesForHome("delegate-1");
    expect(home.thisWeek.routes.map((r) => r.id)).toEqual(["done"]);
    expect(home.thisWeek.routes[0]?.status).toBe("COMPLETED");
  });

  it("uses Monday–Sunday weeks in Kinshasa: on a Sunday evening UTC it is already the next week there", async () => {
    findRoutesForVisitorOverlapping.mockResolvedValue([]);
    // Sun 21 June 23:30 UTC = Mon 22 June 00:30 in Kinshasa.
    await getMyRoutesForHome("delegate-1", new Date("2026-06-21T23:30:00.000Z"));
    expect(findRoutesForVisitorOverlapping).toHaveBeenCalledWith(
      "delegate-1",
      MON_NEXT,
      new Date("2026-07-05T00:00:00.000Z"),
    );
  });

  it("returns empty sections when nothing is assigned", async () => {
    findRoutesForVisitorOverlapping.mockResolvedValue([]);

    const home = await getMyRoutesForHome("delegate-1");
    expect(home.thisWeek.routes).toEqual([]);
    expect(home.upcomingWeek.routes).toEqual([]);
  });
});

describe("searchAssignableRoutesForActor", () => {
  it("asks only for the actor's own unassigned drafts (ADMIN: anyone's), bounded", async () => {
    searchAssignableRoutes.mockResolvedValue([]);

    await searchAssignableRoutesForActor({ q: "rt", limit: 20 }, "supervisor-1", "SUPERVISOR");
    expect(searchAssignableRoutes).toHaveBeenCalledWith({
      creatorId: "supervisor-1",
      isAdmin: false,
      q: "rt",
      limit: 20,
    });

    await searchAssignableRoutesForActor({ q: "", limit: 20 }, "admin-1", "ADMIN");
    expect(searchAssignableRoutes).toHaveBeenLastCalledWith(
      expect.objectContaining({ isAdmin: true }),
    );
  });

  it("describes each route by code, center and contact counts", async () => {
    searchAssignableRoutes.mockResolvedValue([
      {
        id: "r1",
        code: "RT-00007",
        items: [
          { status: "PENDING", center: { name: "Alpha" }, contacts: [{ id: "a" }, { id: "b" }] },
          { status: "PENDING", center: { name: "Beta" }, contacts: [] },
        ],
      },
    ]);

    const [row] = await searchAssignableRoutesForActor({ q: "", limit: 20 }, "s", "SUPERVISOR");
    expect(row).toEqual({
      id: "r1",
      code: "RT-00007",
      centerCount: 2,
      contactCount: 2,
      centerNames: ["Alpha", "Beta"],
    });
  });
});

describe("searchAssigneesForActor", () => {
  it("restricts a non-admin to themselves and their downstream team, active users only", async () => {
    getDownstreamUserIds.mockResolvedValue(["d1", "d2"]);
    searchActiveUsers.mockResolvedValue([]);

    await searchAssigneesForActor({ q: "jo", limit: 20 }, "supervisor-1", "SUPERVISOR");
    expect(searchActiveUsers).toHaveBeenCalledWith({
      ids: ["supervisor-1", "d1", "d2"],
      q: "jo",
      limit: 20,
    });
  });

  it("lets ADMIN search every active user", async () => {
    searchActiveUsers.mockResolvedValue([]);

    await searchAssigneesForActor({ q: "", limit: 20 }, "admin-1", "ADMIN");
    expect(searchActiveUsers).toHaveBeenCalledWith({ ids: undefined, q: "", limit: 20 });
    expect(getDownstreamUserIds).not.toHaveBeenCalled();
  });

  it("maps users to a safe shape", async () => {
    getDownstreamUserIds.mockResolvedValue([]);
    searchActiveUsers.mockResolvedValue([
      { id: "u1", name: "Jo", employeeCode: "E1", role: { name: "DELEGATE" }, passwordHash: "x" },
    ]);

    const [user] = await searchAssigneesForActor({ q: "", limit: 20 }, "s", "SUPERVISOR");
    expect(user).toEqual({ id: "u1", name: "Jo", employeeCode: "E1", roleName: "DELEGATE" });
  });
});

describe("getAssigneeFilterLabel", () => {
  it("names a user inside the actor's reach", async () => {
    getDownstreamUserIds.mockResolvedValue(["d1"]);
    findUserById.mockResolvedValue({ name: "Jo", employeeCode: "E1", status: "ACTIVE" });

    await expect(getAssigneeFilterLabel("d1", "supervisor-1", "SUPERVISOR")).resolves.toBe(
      "Jo (E1)",
    );
  });

  it("returns nothing for an id outside the actor's reach, without looking the user up", async () => {
    getDownstreamUserIds.mockResolvedValue(["d1"]);

    await expect(
      getAssigneeFilterLabel("stranger", "supervisor-1", "SUPERVISOR"),
    ).resolves.toBeNull();
    expect(findUserById).not.toHaveBeenCalled();
  });
});
