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

const cancelAssignmentRow = vi.fn();
const createAssignmentRow = vi.fn();
const createRouteItem = vi.fn();
const createRouteItemContacts = vi.fn();
const createRouteRow = vi.fn();
const deleteAllRouteItemContacts = vi.fn();
const deleteRouteItemContacts = vi.fn();
const deleteRouteItem = vi.fn();
const findActiveAssignmentsForRoute = vi.fn();
const findActiveAssignmentsForVisitor = vi.fn();
const findActiveAssignmentsForVisitorOverlapping = vi.fn();
const findActiveCenterIdsForVisitorInRange = vi.fn();
// Data source for the Add Routes list; the page mock below wraps it the way
// the repository's findEditableRoutesPage does (a page of routes plus a total).
const findEditableRoutes = vi.fn();
const findEditableRoutesPage = vi.fn(async () => {
  const routes = (await findEditableRoutes()) as unknown[];
  return { routes, total: routes.length };
});
const findAssignmentById = vi.fn();
const findContactExecutionStatus = vi.fn();
// Data source for the Assign Routes table; wraps it the way the
// repository's findAssignmentsPage does (a page of assignments plus a total).
const findAssignments = vi.fn();
const findAssignmentsPage = vi.fn(async () => {
  const assignments = (await findAssignments()) as unknown[];
  return { assignments, total: assignments.length };
});
const findRouteById = vi.fn();
const findRouteItemById = vi.fn();
const findRouteItemContactById = vi.fn();
const listContactStatusesForItem = vi.fn();
const listPendingContactIdsForItem = vi.fn();
const listPendingExecutionTargetsForAssignment = vi.fn();
const runInTransaction = vi.fn(async (fn: (tx: typeof TX) => Promise<unknown>) => fn(TX));
const searchAssignableRoutes = vi.fn();
const updateRouteItemSequence = vi.fn();
const upsertContactExecution = vi.fn();
const upsertItemExecution = vi.fn();
vi.mock("@/server/repositories/route-repository", () => ({
  cancelAssignmentRow,
  createAssignmentRow,
  createRouteItem,
  createRouteItemContacts,
  createRouteRow,
  deleteAllRouteItemContacts,
  deleteRouteItemContacts,
  deleteRouteItem,
  findActiveAssignmentsForRoute,
  findActiveAssignmentsForVisitor,
  findActiveAssignmentsForVisitorOverlapping,
  findActiveCenterIdsForVisitorInRange,
  findEditableRoutesPage,
  findAssignmentById,
  findAssignmentsPage,
  findContactExecutionStatus,
  findRouteById,
  findRouteItemById,
  findRouteItemContactById,
  listContactStatusesForItem,
  listPendingContactIdsForItem,
  listPendingExecutionTargetsForAssignment,
  runInTransaction,
  searchAssignableRoutes,
  updateRouteItemSequence,
  upsertContactExecution,
  upsertItemExecution,
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
  listRoutesForContent,
  getMyVisits,
  completeRouteItemContact,
  cancelRouteItemContact,
  deriveCenterStatus,
  deriveRouteStatus,
  listRoutesForAssignment,
  getRouteForManagement,
  getAssignmentForManagement,
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
  RouteAlreadyAssignedToUserError,
  RouteHasNothingToAssignError,
  AssignmentNotFoundError,
  AssignmentNotActiveError,
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
  return {
    centerId,
    contactId,
    contact: { status },
    specialization: { name: "Cardiology" },
  };
}

function contactRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "rc-1",
    routeItemId: "item-1",
    contactId: "contact-1",
    contact: { id: "contact-1", name: "Dr One", code: "CON-00001", status: "ACTIVE" },
    executions: [],
    ...overrides,
  };
}

const getRoutesForAssignment = async (actorId: string, role: string) =>
  (await listRoutesForAssignment({ page: 1, pageSize: 10 }, actorId, role)).items;

const TODAY = new Date("2026-06-15T00:00:00.000Z");
const TOMORROW = new Date("2026-06-16T00:00:00.000Z");
const YESTERDAY = new Date("2026-06-14T00:00:00.000Z");
const NEXT_WEEK = new Date("2026-06-22T00:00:00.000Z");

// Shared plan content only — no assignee data at all (that's `assignment`
// below). `executions` on an item/contact is the "has anyone, ever, acted
// on this" signal content editing checks; empty means untouched.
function route(overrides: Record<string, unknown> = {}) {
  return {
    id: "route-1",
    code: "RT-00001",
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
    center: {
      id: "center-1",
      territoryId: "territory-1",
      name: "Center",
      code: "C-1",
      type: { name: "Hospital" },
    },
    contacts: [],
    executions: [],
    ...overrides,
  };
}

// One assignment, with the route's content embedded (as findAssignmentById
// returns it) and this assignment's own item/contact execution rows.
function assignment(overrides: Record<string, unknown> = {}) {
  return {
    id: "assignment-1",
    routeId: "route-1",
    userId: "delegate-1",
    status: "ACTIVE",
    startDate: TOMORROW,
    endDate: TOMORROW,
    route: route({ items: [item()] }),
    user: { id: "delegate-1", name: "Delegate One" },
    itemExecutions: [] as { routeItemId: string; status: string }[],
    contactExecutions: [] as { routeItemContactId: string; status: string }[],
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
  createRouteItem.mockResolvedValue({ id: "item-1", sequence: 0 });
  createAssignmentRow.mockResolvedValue({ id: "assignment-1" });
  getDownstreamUserIds.mockResolvedValue([]);
  findActiveAssignmentsForRoute.mockResolvedValue([]);
  findActiveCenterIdsForVisitorInRange.mockResolvedValue(new Set());
  findCenterContactLinks.mockResolvedValue([]);
  listContactStatusesForItem.mockResolvedValue([]);
  listPendingContactIdsForItem.mockResolvedValue([]);
  findContactExecutionStatus.mockResolvedValue("PENDING");
  listPendingExecutionTargetsForAssignment.mockResolvedValue({
    itemIds: [],
    itemsWithContactsIds: [],
    contactIds: [],
  });
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
  it("allows the creator to save their own route with no active assignments", async () => {
    findRouteById.mockResolvedValue(route());

    await expect(saveRouteContent("route-1", [], "creator-1", "SUPERVISOR")).resolves.toBe(
      "route-1",
    );
  });

  it("rejects someone else saving a route they didn't create and aren't assigned to", async () => {
    findRouteById.mockResolvedValue(route());

    await expect(saveRouteContent("route-1", [], "someone-else", "SUPERVISOR")).rejects.toThrow(
      RouteNotAuthorizedError,
    );
  });

  it("allows ADMIN to save anyone's route", async () => {
    findRouteById.mockResolvedValue(route());

    await expect(saveRouteContent("route-1", [], "admin-1", "ADMIN")).resolves.toBe("route-1");
  });

  it("allows an active assignee to save content on their own route", async () => {
    findRouteById.mockResolvedValue(route());
    findActiveAssignmentsForRoute.mockResolvedValue([
      { userId: "delegate-1", startDate: TOMORROW, endDate: TOMORROW },
    ]);

    await expect(saveRouteContent("route-1", [], "delegate-1", "DELEGATE")).resolves.toBe(
      "route-1",
    );
  });

  it("allows a chain-assignor to save an already-assigned route", async () => {
    findRouteById.mockResolvedValue(route());
    findActiveAssignmentsForRoute.mockResolvedValue([
      { userId: "delegate-1", startDate: TOMORROW, endDate: TOMORROW },
    ]);
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await expect(saveRouteContent("route-1", [], "supervisor-1", "SUPERVISOR")).resolves.toBe(
      "route-1",
    );
  });

  it("rejects saving once the earliest active assignment's date has started", async () => {
    findRouteById.mockResolvedValue(route());
    findActiveAssignmentsForRoute.mockResolvedValue([
      { userId: "delegate-1", startDate: TODAY, endDate: TODAY },
    ]);

    await expect(saveRouteContent("route-1", [], "delegate-1", "DELEGATE")).rejects.toThrow(
      RouteEditCutoffError,
    );
  });

  it("never gates a route with no active assignments by the edit cutoff", async () => {
    findRouteById.mockResolvedValue(route());

    await expect(saveRouteContent("route-1", [], "creator-1", "SUPERVISOR")).resolves.toBe(
      "route-1",
    );
  });

  it("freezes content once ANY active assignee has started, even if another hasn't", async () => {
    findRouteById.mockResolvedValue(route());
    findActiveAssignmentsForRoute.mockResolvedValue([
      { userId: "delegate-1", startDate: TODAY, endDate: TODAY },
      { userId: "delegate-2", startDate: NEXT_WEEK, endDate: NEXT_WEEK },
    ]);

    await expect(saveRouteContent("route-1", [], "delegate-2", "DELEGATE")).rejects.toThrow(
      RouteEditCutoffError,
    );
  });
});

describe("saveRouteContent — territory and duplicate validation", () => {
  it("validates new centers against the creator's territories while nobody's assigned", async () => {
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

  it("validates new centers against the assignee's territories once assigned", async () => {
    findRouteById.mockResolvedValue(route());
    findActiveAssignmentsForRoute.mockResolvedValue([
      { userId: "delegate-1", startDate: TOMORROW, endDate: TOMORROW },
    ]);
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

  it("rejects a new center already active for an assignee on this date on a different route", async () => {
    findRouteById.mockResolvedValue(route());
    findActiveAssignmentsForRoute.mockResolvedValue([
      { userId: "delegate-1", startDate: TOMORROW, endDate: TOMORROW },
    ]);
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

  it("never runs the cross-route duplicate check with no active assignments (no date to check against)", async () => {
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
  it("removes an untouched item no longer in the desired list", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()] }));

    await saveRouteContent("route-1", [], "creator-1", "SUPERVISOR");
    expect(deleteAllRouteItemContacts).toHaveBeenCalledWith("item-1", TX);
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

  it("never touches an item any assignment has already acted on, even if left out of the desired list", async () => {
    findRouteById.mockResolvedValue(
      route({ items: [item({ executions: [{ status: "COMPLETED" }] })] }),
    );
    findActiveAssignmentsForRoute.mockResolvedValue([
      { userId: "delegate-1", startDate: TOMORROW, endDate: TOMORROW },
    ]);

    await saveRouteContent("route-1", [], "delegate-1", "DELEGATE");
    expect(deleteRouteItem).not.toHaveBeenCalled();
  });

  it("rejects re-adding a center any assignment already acted on", async () => {
    findRouteById.mockResolvedValue(
      route({ items: [item({ executions: [{ status: "CANCELLED" }] })] }),
    );

    await expect(
      saveRouteContent("route-1", sel("center-1"), "creator-1", "SUPERVISOR"),
    ).rejects.toThrow(CenterAlreadyOnRouteError);
  });
});

describe("reorderRouteItems", () => {
  it("is never gated by the edit cutoff, even once an active assignee has started", async () => {
    findRouteById.mockResolvedValue(route());
    findActiveAssignmentsForRoute.mockResolvedValue([
      { userId: "delegate-1", startDate: TODAY, endDate: TODAY },
    ]);

    await reorderRouteItems("route-1", ["item-1"], "delegate-1", "DELEGATE");
    expect(updateRouteItemSequence).toHaveBeenCalledWith("item-1", 0, "delegate-1");
  });
});

describe("completeRouteItem / cancelRouteItem", () => {
  it("completeRouteItem rejects anyone but the assignment's holder, even an in-chain supervisor", async () => {
    findRouteItemById.mockResolvedValue({ id: "item-1", route: route(), contacts: [] });
    findAssignmentById.mockResolvedValue(assignment({ userId: "delegate-1" }));

    await expect(completeRouteItem("item-1", "assignment-1", "supervisor-1")).rejects.toThrow(
      RouteNotOwnedError,
    );
  });

  it("completeRouteItem rejects a no-longer-active assignment", async () => {
    findRouteItemById.mockResolvedValue({ id: "item-1", route: route(), contacts: [] });
    findAssignmentById.mockResolvedValue(assignment({ userId: "delegate-1", status: "CANCELLED" }));

    await expect(completeRouteItem("item-1", "assignment-1", "delegate-1")).rejects.toThrow(
      AssignmentNotActiveError,
    );
  });

  it("cancelRouteItem does nothing when the assignment can't be found", async () => {
    findRouteItemById.mockResolvedValue({ id: "item-1", route: route(), contacts: [] });
    findAssignmentById.mockResolvedValue(null);

    await expect(
      cancelRouteItem("item-1", "assignment-1", "creator-1", "SUPERVISOR"),
    ).resolves.toBeUndefined();
    expect(upsertItemExecution).not.toHaveBeenCalled();
  });

  it("cancelRouteItem rejects someone outside the assignment holder's downstream chain", async () => {
    findRouteItemById.mockResolvedValue({ id: "item-1", route: route(), contacts: [] });
    findAssignmentById.mockResolvedValue(assignment({ userId: "delegate-1" }));
    getDownstreamUserIds.mockResolvedValue([]);

    await expect(
      cancelRouteItem("item-1", "assignment-1", "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(RouteNotAuthorizedError);
  });
});

describe("assignRoute — concurrent assignment", () => {
  it("creates a new ACTIVE assignment for the whole range in one call", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()], createdBy: "supervisor-1" }));
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);
    createAssignmentRow.mockResolvedValue({ id: "assignment-new" });

    await expect(
      assignRoute("route-1", "delegate-1", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).resolves.toBe("assignment-new");
    expect(createAssignmentRow).toHaveBeenCalledWith(
      { routeId: "route-1", userId: "delegate-1", startDate: TOMORROW, endDate: NEXT_WEEK },
      "supervisor-1",
    );
    expect(createRouteRow).not.toHaveBeenCalled();
  });

  it("allows a range starting today", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()], createdBy: "supervisor-1" }));
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await expect(
      assignRoute("route-1", "delegate-1", TODAY, TOMORROW, "supervisor-1", "SUPERVISOR"),
    ).resolves.toBe("assignment-1");
  });

  it("still offers an already-assigned route — assigning a second, different person succeeds", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()], createdBy: "supervisor-1" }));
    findActiveAssignmentsForRoute.mockResolvedValue([{ userId: "delegate-1" }]);
    getDownstreamUserIds.mockResolvedValue(["delegate-1", "delegate-2"]);

    await expect(
      assignRoute("route-1", "delegate-2", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).resolves.toBe("assignment-1");
  });

  it("refuses assigning the same person who still has pending work on this route", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()], createdBy: "supervisor-1" }));
    findActiveAssignmentsForRoute.mockResolvedValue([
      { id: "assignment-existing", userId: "delegate-1" },
    ]);
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);
    listPendingExecutionTargetsForAssignment.mockResolvedValue({
      itemIds: ["item-1"],
      itemsWithContactsIds: [],
      contactIds: [],
    });

    await expect(
      assignRoute("route-1", "delegate-1", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(RouteAlreadyAssignedToUserError);
    expect(createAssignmentRow).not.toHaveBeenCalled();
  });

  it("allows re-assigning the same person once their existing assignment has nothing pending left — an ACTIVE row never auto-completes", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()], createdBy: "supervisor-1" }));
    findActiveAssignmentsForRoute.mockResolvedValue([
      { id: "assignment-existing", userId: "delegate-1" },
    ]);
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);
    listPendingExecutionTargetsForAssignment.mockResolvedValue({
      itemIds: [],
      itemsWithContactsIds: [],
      contactIds: [],
    });

    await expect(
      assignRoute("route-1", "delegate-1", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).resolves.toBe("assignment-1");
  });

  it("rejects assigning someone else's draft by id when the actor has no reach", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()], createdBy: "someone-else" }));
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await expect(
      assignRoute("route-1", "delegate-1", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(RouteNotAuthorizedError);
    expect(createAssignmentRow).not.toHaveBeenCalled();
  });

  it("lets ADMIN assign anyone's draft to anyone", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()], createdBy: "someone-else" }));

    await expect(
      assignRoute("route-1", "delegate-1", TOMORROW, NEXT_WEEK, "admin-1", "ADMIN"),
    ).resolves.toBe("assignment-1");
  });

  it("rejects assigning to a target outside the actor's downstream chain", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()], createdBy: "supervisor-1" }));
    getDownstreamUserIds.mockResolvedValue([]);

    await expect(
      assignRoute("route-1", "someone-else", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(RouteNotAuthorizedError);
    expect(createAssignmentRow).not.toHaveBeenCalled();
  });

  it("lets the actor assign a route to themselves", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()], createdBy: "supervisor-1" }));

    await expect(
      assignRoute("route-1", "supervisor-1", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).resolves.toBe("assignment-1");
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
    expect(createAssignmentRow).not.toHaveBeenCalled();
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
    ).resolves.toBe("assignment-1");
  });

  it("rejects an end date before the start date", async () => {
    findRouteById.mockResolvedValue(route({ items: [item()], createdBy: "supervisor-1" }));
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await expect(
      assignRoute("route-1", "delegate-1", NEXT_WEEK, TOMORROW, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(InvalidDateRangeError);
  });

  it("rejects a route with no stops at all", async () => {
    findRouteById.mockResolvedValue(route({ items: [], createdBy: "supervisor-1" }));
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await expect(
      assignRoute("route-1", "delegate-1", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(RouteHasNothingToAssignError);
  });

  it("still offers a route whose only items were cancelled for a different assignee", async () => {
    findRouteById.mockResolvedValue(
      route({
        items: [item({ executions: [{ status: "CANCELLED" }] })],
        createdBy: "supervisor-1",
      }),
    );
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await expect(
      assignRoute("route-1", "delegate-1", TOMORROW, NEXT_WEEK, "supervisor-1", "SUPERVISOR"),
    ).resolves.toBe("assignment-1");
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
    expect(createAssignmentRow).not.toHaveBeenCalled();
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
  it("cancels the old assignment and creates a new one for the new holder — route and items untouched", async () => {
    findAssignmentById.mockResolvedValue(assignment());
    getDownstreamUserIds.mockResolvedValue(["delegate-1", "delegate-2"]);
    createAssignmentRow.mockResolvedValue({ id: "assignment-new" });

    const result = await reassignRoute(
      "assignment-1",
      "delegate-2",
      TOMORROW,
      NEXT_WEEK,
      "supervisor-1",
      "SUPERVISOR",
    );

    expect(result).toBe("assignment-new");
    expect(createRouteRow).not.toHaveBeenCalled();
    expect(deleteRouteItem).not.toHaveBeenCalled();
    expect(cancelAssignmentRow).toHaveBeenCalledWith("assignment-1", "supervisor-1", TX);
    expect(createAssignmentRow).toHaveBeenCalledWith(
      { routeId: "route-1", userId: "delegate-2", startDate: TOMORROW, endDate: NEXT_WEEK },
      "supervisor-1",
      TX,
    );
  });

  it("refuses an assignment that can't be found", async () => {
    findAssignmentById.mockResolvedValue(null);

    await expect(
      reassignRoute(
        "assignment-1",
        "delegate-1",
        TOMORROW,
        NEXT_WEEK,
        "supervisor-1",
        "SUPERVISOR",
      ),
    ).rejects.toThrow(AssignmentNotFoundError);
  });

  it("refuses an assignment that's already been cancelled", async () => {
    findAssignmentById.mockResolvedValue(assignment({ status: "CANCELLED" }));
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await expect(
      reassignRoute(
        "assignment-1",
        "delegate-2",
        TOMORROW,
        NEXT_WEEK,
        "supervisor-1",
        "SUPERVISOR",
      ),
    ).rejects.toThrow(AssignmentNotActiveError);
  });

  it("refuses to reassign once any item on this assignment is COMPLETED", async () => {
    findAssignmentById.mockResolvedValue(
      assignment({ itemExecutions: [{ routeItemId: "item-1", status: "COMPLETED" }] }),
    );
    getDownstreamUserIds.mockResolvedValue(["delegate-1", "delegate-2"]);

    await expect(
      reassignRoute(
        "assignment-1",
        "delegate-2",
        TOMORROW,
        NEXT_WEEK,
        "supervisor-1",
        "SUPERVISOR",
      ),
    ).rejects.toThrow(RouteHasCompletedItemsError);
    expect(cancelAssignmentRow).not.toHaveBeenCalled();
    expect(createAssignmentRow).not.toHaveBeenCalled();
  });

  it("refuses to reassign once any contact on this assignment is COMPLETED", async () => {
    findAssignmentById.mockResolvedValue(
      assignment({ contactExecutions: [{ routeItemContactId: "rc-1", status: "COMPLETED" }] }),
    );
    getDownstreamUserIds.mockResolvedValue(["delegate-1", "delegate-2"]);

    await expect(
      reassignRoute(
        "assignment-1",
        "delegate-2",
        TOMORROW,
        NEXT_WEEK,
        "supervisor-1",
        "SUPERVISOR",
      ),
    ).rejects.toThrow(RouteHasCompletedItemsError);
  });

  it("still allows reassignment when the only non-pending items are cancelled", async () => {
    findAssignmentById.mockResolvedValue(
      assignment({ itemExecutions: [{ routeItemId: "item-1", status: "CANCELLED" }] }),
    );
    getDownstreamUserIds.mockResolvedValue(["delegate-1", "delegate-2"]);

    await expect(
      reassignRoute(
        "assignment-1",
        "delegate-2",
        TOMORROW,
        NEXT_WEEK,
        "supervisor-1",
        "SUPERVISOR",
      ),
    ).resolves.toBe("assignment-1");
  });

  it("rejects an actor outside the current holder's downstream chain", async () => {
    findAssignmentById.mockResolvedValue(assignment());
    getDownstreamUserIds.mockResolvedValue(["delegate-2"]);

    await expect(
      reassignRoute(
        "assignment-1",
        "delegate-2",
        TOMORROW,
        NEXT_WEEK,
        "supervisor-1",
        "SUPERVISOR",
      ),
    ).rejects.toThrow(RouteNotAuthorizedError);
  });

  it("requires the new range to start no earlier than today and the new assignee to be active", async () => {
    findAssignmentById.mockResolvedValue(assignment());
    getDownstreamUserIds.mockResolvedValue(["delegate-1", "delegate-2"]);

    await expect(
      reassignRoute(
        "assignment-1",
        "delegate-2",
        YESTERDAY,
        TOMORROW,
        "supervisor-1",
        "SUPERVISOR",
      ),
    ).rejects.toThrow(RouteStartInPastError);

    findUserById.mockResolvedValueOnce({ territoryId: null, status: "INACTIVE" });
    await expect(
      reassignRoute(
        "assignment-1",
        "delegate-2",
        TOMORROW,
        NEXT_WEEK,
        "supervisor-1",
        "SUPERVISOR",
      ),
    ).rejects.toThrow(AssigneeNotAssignableError);
  });
});

describe("cancelRouteAssignment", () => {
  it("flips the assignment to CANCELLED and cancels every still-pending target for it", async () => {
    findAssignmentById.mockResolvedValue(assignment());
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);
    listPendingExecutionTargetsForAssignment.mockResolvedValue({
      itemIds: ["item-2"],
      itemsWithContactsIds: ["item-3"],
      contactIds: ["rc-1"],
    });

    await cancelRouteAssignment("assignment-1", "supervisor-1", "SUPERVISOR");

    expect(upsertItemExecution).toHaveBeenCalledWith(
      "item-2",
      "assignment-1",
      "CANCELLED",
      "supervisor-1",
      TX,
    );
    expect(upsertContactExecution).toHaveBeenCalledWith(
      "rc-1",
      "assignment-1",
      "CANCELLED",
      "supervisor-1",
      TX,
    );
    expect(cancelAssignmentRow).toHaveBeenCalledWith("assignment-1", "supervisor-1", TX);
  });

  it("does nothing for an assignment that can't be found or isn't active", async () => {
    findAssignmentById.mockResolvedValue(null);
    await cancelRouteAssignment("assignment-1", "creator-1", "SUPERVISOR");
    expect(cancelAssignmentRow).not.toHaveBeenCalled();

    findAssignmentById.mockResolvedValue(assignment({ status: "CANCELLED" }));
    await cancelRouteAssignment("assignment-1", "creator-1", "SUPERVISOR");
    expect(cancelAssignmentRow).not.toHaveBeenCalled();
  });

  it("never touches another assignee's own progress on the same shared route", async () => {
    // Cancelling assignment-1 only ever queries/writes execution rows keyed
    // to assignment-1 — a second assignee's RouteItemExecution rows (keyed
    // to their own assignmentId) are structurally untouched by this call.
    findAssignmentById.mockResolvedValue(assignment({ id: "assignment-1" }));
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);
    listPendingExecutionTargetsForAssignment.mockResolvedValue({
      itemIds: ["item-1"],
      itemsWithContactsIds: [],
      contactIds: [],
    });

    await cancelRouteAssignment("assignment-1", "supervisor-1", "SUPERVISOR");

    expect(listPendingExecutionTargetsForAssignment).toHaveBeenCalledWith(
      "route-1",
      "assignment-1",
      TX,
    );
    expect(upsertItemExecution).toHaveBeenCalledTimes(1);
    expect(upsertItemExecution).toHaveBeenCalledWith(
      "item-1",
      "assignment-1",
      "CANCELLED",
      "supervisor-1",
      TX,
    );
  });
});

describe("deriveCenterStatus", () => {
  it("has no derived status when there are no contacts (center stays manual)", () => {
    expect(deriveCenterStatus([])).toBeNull();
  });

  it("stays PENDING while any contact is still PENDING, even if others are done", () => {
    expect(deriveCenterStatus(["COMPLETED", "PENDING"])).toBe("PENDING");
  });

  it("is COMPLETED once none are PENDING and at least one is COMPLETED", () => {
    expect(deriveCenterStatus(["COMPLETED", "CANCELLED"])).toBe("COMPLETED");
  });

  it("is CANCELLED only when every contact is CANCELLED", () => {
    expect(deriveCenterStatus(["CANCELLED", "CANCELLED"])).toBe("CANCELLED");
  });
});

describe("deriveRouteStatus", () => {
  it("is UNASSIGNED when there's no holder", () => {
    expect(deriveRouteStatus({ userId: null, status: null, endDate: null }, [])).toBe("UNASSIGNED");
  });

  it("is CANCELLED when the assignment itself was cancelled, regardless of items", () => {
    expect(
      deriveRouteStatus({ userId: "delegate-1", status: "CANCELLED", endDate: TOMORROW }, [
        "PENDING",
      ]),
    ).toBe("CANCELLED");
  });

  it("is ASSIGNED while everything is pending and the range isn't over", () => {
    expect(
      deriveRouteStatus(
        { userId: "delegate-1", status: "ACTIVE", endDate: TOMORROW },
        ["PENDING"],
        TODAY,
      ),
    ).toBe("ASSIGNED");
  });

  it("is IN_PROGRESS with some completed and some pending", () => {
    expect(
      deriveRouteStatus(
        { userId: "delegate-1", status: "ACTIVE", endDate: TOMORROW },
        ["PENDING", "COMPLETED"],
        TODAY,
      ),
    ).toBe("IN_PROGRESS");
  });

  it("is COMPLETED once nothing is pending and something was completed", () => {
    expect(
      deriveRouteStatus(
        { userId: "delegate-1", status: "ACTIVE", endDate: TOMORROW },
        ["COMPLETED", "CANCELLED"],
        TODAY,
      ),
    ).toBe("COMPLETED");
  });

  it("is CANCELLED (derived) only when every item is cancelled", () => {
    expect(
      deriveRouteStatus(
        { userId: "delegate-1", status: "ACTIVE", endDate: TOMORROW },
        ["CANCELLED", "CANCELLED"],
        TODAY,
      ),
    ).toBe("CANCELLED");
  });

  it("is MISSED when something is still pending after the range ended", () => {
    expect(
      deriveRouteStatus(
        { userId: "delegate-1", status: "ACTIVE", endDate: YESTERDAY },
        ["PENDING"],
        TODAY,
      ),
    ).toBe("MISSED");
  });

  it("treats an assigned route with no items as ASSIGNED", () => {
    expect(
      deriveRouteStatus({ userId: "delegate-1", status: "ACTIVE", endDate: TOMORROW }, []),
    ).toBe("ASSIGNED");
  });
});

describe("concurrent assignment — independent progress", () => {
  it("two assignments on the same route merge item statuses from their own executions only", async () => {
    const sharedRoute = route({ items: [item()] });
    findAssignments.mockResolvedValue([
      assignment({
        id: "assignment-1",
        userId: "delegate-1",
        route: sharedRoute,
        itemExecutions: [{ routeItemId: "item-1", status: "COMPLETED" }],
      }),
      assignment({
        id: "assignment-2",
        userId: "delegate-2",
        route: sharedRoute,
        itemExecutions: [],
      }),
    ]);
    getDownstreamUserIds.mockResolvedValue(["delegate-1", "delegate-2"]);

    const summaries = await getRoutesForAssignment("supervisor-1", "SUPERVISOR");
    expect(summaries).toHaveLength(2);
    const byAssignee = new Map(summaries.map((s) => [s.userId, s]));
    expect(byAssignee.get("delegate-1")?.items[0]?.status).toBe("COMPLETED");
    expect(byAssignee.get("delegate-2")?.items[0]?.status).toBe("PENDING");
  });
});

describe("listRoutesForAssignment", () => {
  it("applies the actor's scope on the server and pages with skip/take", async () => {
    findAssignments.mockResolvedValue([]);
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await listRoutesForAssignment({ page: 2, pageSize: 5 }, "supervisor-1", "SUPERVISOR");
    expect(findAssignmentsPage).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { creatorId: "supervisor-1", assignedUserIds: ["supervisor-1", "delegate-1"] },
        skip: 5,
        take: 5,
      }),
    );
  });

  it("gives ADMIN no scope restriction", async () => {
    findAssignments.mockResolvedValue([]);

    await listRoutesForAssignment({ page: 1, pageSize: 10 }, "admin-1", "ADMIN");
    expect(findAssignmentsPage).toHaveBeenCalledWith(
      expect.objectContaining({ scope: { creatorId: "admin-1", assignedUserIds: undefined } }),
    );
  });

  it("returns summaries with the derived status, code and range", async () => {
    findAssignments.mockResolvedValue([assignment({ route: route({ items: [item()] }) })]);

    const [summary] = await getRoutesForAssignment("admin-1", "ADMIN");
    expect(summary).toMatchObject({
      id: "route-1",
      assignmentId: "assignment-1",
      code: "RT-00001",
      userId: "delegate-1",
      status: "ASSIGNED",
    });
  });
});

describe("getRouteForManagement", () => {
  it("returns the route content for someone who may act on it", async () => {
    findRouteById.mockResolvedValue(route());

    const summary = await getRouteForManagement("route-1", "creator-1", "SUPERVISOR");
    expect(summary?.id).toBe("route-1");
  });

  it("returns null — same as not found — for a route the actor can't act on", async () => {
    findRouteById.mockResolvedValue(route());

    const summary = await getRouteForManagement("route-1", "someone-else", "SUPERVISOR");
    expect(summary).toBeNull();
  });
});

describe("getAssignmentForManagement", () => {
  it("returns the assignment for its own holder", async () => {
    findAssignmentById.mockResolvedValue(assignment());

    const summary = await getAssignmentForManagement("assignment-1", "delegate-1", "DELEGATE");
    expect(summary?.assignmentId).toBe("assignment-1");
  });

  it("returns null for someone outside the holder's downstream chain", async () => {
    findAssignmentById.mockResolvedValue(assignment());
    getDownstreamUserIds.mockResolvedValue([]);

    const summary = await getAssignmentForManagement("assignment-1", "supervisor-1", "SUPERVISOR");
    expect(summary).toBeNull();
  });
});

describe("getMyVisits / getMyRoutesForHome", () => {
  it("getMyVisits returns every ACTIVE assignment held by the visitor", async () => {
    findActiveAssignmentsForVisitor.mockResolvedValue([assignment()]);

    const result = await getMyVisits("delegate-1");
    expect(result).toHaveLength(1);
    expect(findActiveAssignmentsForVisitor).toHaveBeenCalledWith("delegate-1");
  });

  it("getMyRoutesForHome places an assignment in the week(s) its range overlaps", async () => {
    findActiveAssignmentsForVisitorOverlapping.mockResolvedValue([
      assignment({ startDate: TODAY, endDate: TODAY }),
    ]);

    const home = await getMyRoutesForHome("delegate-1", TODAY);
    expect(home.thisWeek.routes).toHaveLength(1);
  });

  it("displays a PENDING item as MISSED once its assignment's range has passed", async () => {
    findActiveAssignmentsForVisitor.mockResolvedValue([
      assignment({ startDate: YESTERDAY, endDate: YESTERDAY, route: route({ items: [item()] }) }),
    ]);

    const [summary] = await getMyVisits("delegate-1");
    expect(summary?.items[0]?.status).toBe("MISSED");
  });

  it("never relabels a COMPLETED item as MISSED, even for a past range", async () => {
    findActiveAssignmentsForVisitor.mockResolvedValue([
      assignment({
        startDate: YESTERDAY,
        endDate: YESTERDAY,
        route: route({ items: [item()] }),
        itemExecutions: [{ routeItemId: "item-1", status: "COMPLETED" }],
      }),
    ]);

    const [summary] = await getMyVisits("delegate-1");
    expect(summary?.items[0]?.status).toBe("COMPLETED");
  });
});

describe("searchAssignableRoutesForActor", () => {
  it("scopes to the actor (ADMIN: anyone's), bounded", async () => {
    searchAssignableRoutes.mockResolvedValue([]);
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await searchAssignableRoutesForActor({ q: "", limit: 20 }, "supervisor-1", "SUPERVISOR");
    expect(searchAssignableRoutes).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { creatorId: "supervisor-1", assignedUserIds: ["supervisor-1", "delegate-1"] },
      }),
    );
  });

  it("describes each route by code, center and contact counts", async () => {
    searchAssignableRoutes.mockResolvedValue([
      {
        id: "route-1",
        code: "RT-00001",
        items: [
          { center: { name: "Center A" }, contacts: [{ id: "c-1" }] },
          { center: { name: "Center B" }, contacts: [] },
        ],
      },
    ]);

    const [result] = await searchAssignableRoutesForActor({ q: "", limit: 20 }, "admin-1", "ADMIN");
    expect(result).toMatchObject({
      id: "route-1",
      code: "RT-00001",
      centerCount: 2,
      contactCount: 1,
      centerNames: ["Center A", "Center B"],
    });
  });
});

describe("searchAssigneesForActor", () => {
  it("restricts a non-admin to themselves and their downstream team, active users only", async () => {
    searchActiveUsers.mockResolvedValue([]);
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await searchAssigneesForActor({ q: "", limit: 20 }, "supervisor-1", "SUPERVISOR");
    expect(searchActiveUsers).toHaveBeenCalledWith(
      expect.objectContaining({ ids: ["supervisor-1", "delegate-1"] }),
    );
  });

  it("lets ADMIN search every active user", async () => {
    searchActiveUsers.mockResolvedValue([]);

    await searchAssigneesForActor({ q: "", limit: 20 }, "admin-1", "ADMIN");
    expect(searchActiveUsers).toHaveBeenCalledWith(expect.objectContaining({ ids: undefined }));
  });
});

describe("getAssigneeFilterLabel", () => {
  it("names a user inside the actor's reach", async () => {
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);
    findUserById.mockResolvedValue({ name: "Delegate One", employeeCode: "EMP-001" });

    await expect(getAssigneeFilterLabel("delegate-1", "supervisor-1", "SUPERVISOR")).resolves.toBe(
      "Delegate One (EMP-001)",
    );
  });

  it("returns nothing for an id outside the actor's reach, without looking the user up", async () => {
    getDownstreamUserIds.mockResolvedValue([]);

    await expect(
      getAssigneeFilterLabel("someone-else", "supervisor-1", "SUPERVISOR"),
    ).resolves.toBeNull();
    expect(findUserById).not.toHaveBeenCalled();
  });
});

describe("listRoutesForContent", () => {
  it("pages on the server with skip/take, newest first, and returns the total", async () => {
    findEditableRoutes.mockResolvedValue([route(), route({ id: "route-2" })]);

    const result = await listRoutesForContent({ page: 1, pageSize: 10 }, "creator-1", "SUPERVISOR");
    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
  });

  it("scopes a non-admin to their own drafts and their downstream team; ADMIN is unrestricted", async () => {
    findEditableRoutes.mockResolvedValue([]);
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await listRoutesForContent({ page: 1, pageSize: 10 }, "supervisor-1", "SUPERVISOR");
    expect(findEditableRoutesPage).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { creatorId: "supervisor-1", assignedUserIds: ["supervisor-1", "delegate-1"] },
      }),
    );

    await listRoutesForContent({ page: 1, pageSize: 10 }, "admin-1", "ADMIN");
    expect(findEditableRoutesPage).toHaveBeenCalledWith(
      expect.objectContaining({ scope: { creatorId: "admin-1", assignedUserIds: undefined } }),
    );
  });
});

describe("saveRouteContent — contacts", () => {
  beforeEach(() => {
    findCenterById.mockResolvedValue({
      id: "center-1",
      territoryId: "territory-1",
      status: "ACTIVE",
    });
  });

  it("saves several contacts for one center in a single operation", async () => {
    findRouteById.mockResolvedValue(route());
    findCenterContactLinks.mockResolvedValue([
      link("center-1", "contact-1"),
      link("center-1", "contact-2"),
    ]);

    await saveRouteContent(
      "route-1",
      [{ centerId: "center-1", contactIds: ["contact-1", "contact-2"] }],
      "creator-1",
      "SUPERVISOR",
    );
    expect(createRouteItemContacts).toHaveBeenCalledWith(
      "item-1",
      ["contact-1", "contact-2"],
      "creator-1",
      TX,
    );
  });

  it("allows a center with no contacts at all", async () => {
    findRouteById.mockResolvedValue(route());

    await saveRouteContent("route-1", sel("center-1"), "creator-1", "SUPERVISOR");
    expect(createRouteItemContacts).not.toHaveBeenCalled();
  });

  it("rejects a contact that isn't linked to the center it was selected under, writing nothing", async () => {
    findRouteById.mockResolvedValue(route());
    findCenterContactLinks.mockResolvedValue([]);

    await expect(
      saveRouteContent(
        "route-1",
        [{ centerId: "center-1", contactIds: ["contact-1"] }],
        "creator-1",
        "SUPERVISOR",
      ),
    ).rejects.toThrow(InvalidCenterContactError);
    expect(createRouteItem).not.toHaveBeenCalled();
  });

  it("rejects an inactive contact", async () => {
    findRouteById.mockResolvedValue(route());
    findCenterContactLinks.mockResolvedValue([link("center-1", "contact-1", "INACTIVE")]);

    await expect(
      saveRouteContent(
        "route-1",
        [{ centerId: "center-1", contactIds: ["contact-1"] }],
        "creator-1",
        "SUPERVISOR",
      ),
    ).rejects.toThrow(InvalidCenterContactError);
  });

  it("rejects an inactive center", async () => {
    findRouteById.mockResolvedValue(route());
    findCenterById.mockResolvedValue({
      id: "center-1",
      territoryId: "territory-1",
      status: "INACTIVE",
    });

    await expect(
      saveRouteContent("route-1", sel("center-1"), "creator-1", "SUPERVISOR"),
    ).rejects.toThrow(InactiveCenterError);
  });

  it("rejects a center listed twice", async () => {
    findRouteById.mockResolvedValue(route());

    await expect(
      saveRouteContent("route-1", sel("center-1", "center-1"), "creator-1", "SUPERVISOR"),
    ).rejects.toThrow(CenterAlreadyOnRouteError);
  });

  it("adds more contacts to an already-selected center without touching the existing ones", async () => {
    findRouteById.mockResolvedValue(route({ items: [item({ contacts: [contactRow()] })] }));
    findCenterContactLinks.mockResolvedValue([
      link("center-1", "contact-1"),
      link("center-1", "contact-2"),
    ]);

    await saveRouteContent(
      "route-1",
      [{ centerId: "center-1", contactIds: ["contact-1", "contact-2"] }],
      "creator-1",
      "SUPERVISOR",
    );
    expect(createRouteItemContacts).toHaveBeenCalledWith("item-1", ["contact-2"], "creator-1", TX);
    expect(deleteRouteItemContacts).not.toHaveBeenCalled();
  });

  it("removes an untouched contact that is no longer selected", async () => {
    findRouteById.mockResolvedValue(route({ items: [item({ contacts: [contactRow()] })] }));

    await saveRouteContent("route-1", sel("center-1"), "creator-1", "SUPERVISOR");
    expect(deleteRouteItemContacts).toHaveBeenCalledWith("item-1", ["contact-1"], TX);
  });

  it("never revalidates or deletes a contact any assignment already acted on", async () => {
    findRouteById.mockResolvedValue(
      route({
        items: [item({ contacts: [contactRow({ executions: [{ status: "COMPLETED" }] })] })],
      }),
    );

    await saveRouteContent("route-1", sel("center-1"), "creator-1", "SUPERVISOR");
    expect(deleteRouteItemContacts).not.toHaveBeenCalled();
  });

  it("rejects re-selecting a contact that already has a final status", async () => {
    findRouteById.mockResolvedValue(
      route({
        items: [item({ contacts: [contactRow({ executions: [{ status: "COMPLETED" }] })] })],
      }),
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

  it("refuses to remove a center that has a completed contact", async () => {
    findRouteById.mockResolvedValue(
      route({
        items: [item({ contacts: [contactRow({ executions: [{ status: "COMPLETED" }] })] })],
      }),
    );

    await expect(saveRouteContent("route-1", [], "creator-1", "SUPERVISOR")).rejects.toThrow(
      RouteItemHasCompletedContactsError,
    );
  });

  it("writes everything inside one transaction", async () => {
    findRouteById.mockResolvedValue(route());
    findCenterContactLinks.mockResolvedValue([link("center-1", "contact-1")]);

    await saveRouteContent(
      "route-1",
      [{ centerId: "center-1", contactIds: ["contact-1"] }],
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
      route: route(),
      contacts: [contactRow()],
    });
    findAssignmentById.mockResolvedValue(assignment());

    await expect(completeRouteItem("item-1", "assignment-1", "delegate-1")).rejects.toThrow(
      CenterStatusDerivedError,
    );
  });

  it("cancelling a center cancels its pending contacts only, deriving the center from what's left", async () => {
    findRouteItemById.mockResolvedValue({
      id: "item-1",
      route: route(),
      contacts: [contactRow({ id: "rc-1" }), contactRow({ id: "rc-2" })],
    });
    findAssignmentById.mockResolvedValue(assignment());
    listPendingContactIdsForItem.mockResolvedValue(["rc-2"]);
    listContactStatusesForItem.mockResolvedValue(["COMPLETED", "CANCELLED"]);

    await cancelRouteItem("item-1", "assignment-1", "delegate-1", "DELEGATE");
    expect(upsertContactExecution).toHaveBeenCalledTimes(1);
    expect(upsertContactExecution).toHaveBeenCalledWith(
      "rc-2",
      "assignment-1",
      "CANCELLED",
      "delegate-1",
      TX,
    );
    expect(upsertItemExecution).toHaveBeenCalledWith(
      "item-1",
      "assignment-1",
      "COMPLETED",
      "delegate-1",
      TX,
    );
  });

  it("cancelling a center whose contacts are all pending ends CANCELLED", async () => {
    findRouteItemById.mockResolvedValue({
      id: "item-1",
      route: route(),
      contacts: [contactRow()],
    });
    findAssignmentById.mockResolvedValue(assignment());
    listPendingContactIdsForItem.mockResolvedValue(["rc-1"]);
    listContactStatusesForItem.mockResolvedValue(["CANCELLED"]);

    await cancelRouteItem("item-1", "assignment-1", "delegate-1", "DELEGATE");
    expect(upsertItemExecution).toHaveBeenCalledWith(
      "item-1",
      "assignment-1",
      "CANCELLED",
      "delegate-1",
      TX,
    );
  });

  it("a center with no contacts is still cancelled manually, as before", async () => {
    findRouteItemById.mockResolvedValue({ id: "item-1", route: route(), contacts: [] });
    findAssignmentById.mockResolvedValue(assignment());

    await cancelRouteItem("item-1", "assignment-1", "delegate-1", "DELEGATE");
    expect(upsertItemExecution).toHaveBeenCalledWith(
      "item-1",
      "assignment-1",
      "CANCELLED",
      "delegate-1",
    );
  });
});

describe("completeRouteItemContact / cancelRouteItemContact", () => {
  it("only the assignment's own holder can complete a contact, not even an in-chain supervisor", async () => {
    findRouteItemContactById.mockResolvedValue({ id: "rc-1", routeItemId: "item-1" });
    findAssignmentById.mockResolvedValue(assignment({ userId: "delegate-1" }));

    await expect(completeRouteItemContact("rc-1", "assignment-1", "supervisor-1")).rejects.toThrow(
      RouteNotOwnedError,
    );
  });

  it("completing the last pending contact completes the center", async () => {
    findRouteItemContactById.mockResolvedValue({ id: "rc-1", routeItemId: "item-1" });
    findAssignmentById.mockResolvedValue(assignment());
    listContactStatusesForItem.mockResolvedValue(["COMPLETED"]);

    await completeRouteItemContact("rc-1", "assignment-1", "delegate-1");
    expect(upsertContactExecution).toHaveBeenCalledWith(
      "rc-1",
      "assignment-1",
      "COMPLETED",
      "delegate-1",
      TX,
    );
    expect(upsertItemExecution).toHaveBeenCalledWith(
      "item-1",
      "assignment-1",
      "COMPLETED",
      "delegate-1",
      TX,
    );
  });

  it("completing one contact while another is still pending keeps the center PENDING", async () => {
    findRouteItemContactById.mockResolvedValue({ id: "rc-1", routeItemId: "item-1" });
    findAssignmentById.mockResolvedValue(assignment());
    listContactStatusesForItem.mockResolvedValue(["COMPLETED", "PENDING"]);

    await completeRouteItemContact("rc-1", "assignment-1", "delegate-1");
    expect(upsertItemExecution).toHaveBeenCalledWith(
      "item-1",
      "assignment-1",
      "PENDING",
      "delegate-1",
      TX,
    );
  });

  it("cancelling every contact cancels the center", async () => {
    findRouteItemContactById.mockResolvedValue({ id: "rc-1", routeItemId: "item-1" });
    findAssignmentById.mockResolvedValue(assignment());
    listContactStatusesForItem.mockResolvedValue(["CANCELLED"]);

    await cancelRouteItemContact("rc-1", "assignment-1", "delegate-1", "DELEGATE");
    expect(upsertItemExecution).toHaveBeenCalledWith(
      "item-1",
      "assignment-1",
      "CANCELLED",
      "delegate-1",
      TX,
    );
  });

  it("won't complete a contact already cancelled for this assignment", async () => {
    findRouteItemContactById.mockResolvedValue({ id: "rc-1", routeItemId: "item-1" });
    findAssignmentById.mockResolvedValue(assignment());
    findContactExecutionStatus.mockResolvedValue("CANCELLED");

    await expect(completeRouteItemContact("rc-1", "assignment-1", "delegate-1")).rejects.toThrow(
      ContactStatusConflictError,
    );
    expect(upsertContactExecution).not.toHaveBeenCalled();
  });

  it("completing an already-completed contact is a harmless no-op", async () => {
    findRouteItemContactById.mockResolvedValue({ id: "rc-1", routeItemId: "item-1" });
    findAssignmentById.mockResolvedValue(assignment());
    findContactExecutionStatus.mockResolvedValue("COMPLETED");

    await completeRouteItemContact("rc-1", "assignment-1", "delegate-1");
    expect(upsertContactExecution).not.toHaveBeenCalled();
  });

  it("won't cancel a contact already completed for this assignment", async () => {
    findRouteItemContactById.mockResolvedValue({ id: "rc-1", routeItemId: "item-1" });
    findAssignmentById.mockResolvedValue(assignment({ userId: "delegate-1" }));
    findContactExecutionStatus.mockResolvedValue("COMPLETED");

    await expect(
      cancelRouteItemContact("rc-1", "assignment-1", "delegate-1", "DELEGATE"),
    ).rejects.toThrow(ContactStatusConflictError);
    expect(upsertContactExecution).not.toHaveBeenCalled();
  });

  it("rejects cancelling for someone outside the assignment holder's downstream chain", async () => {
    findRouteItemContactById.mockResolvedValue({ id: "rc-1", routeItemId: "item-1" });
    findAssignmentById.mockResolvedValue(assignment({ userId: "delegate-1" }));
    getDownstreamUserIds.mockResolvedValue([]);

    await expect(
      cancelRouteItemContact("rc-1", "assignment-1", "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(RouteNotAuthorizedError);
  });
});

describe("route summaries — contacts", () => {
  it("flags a saved contact whose center link was removed, but keeps it listed", async () => {
    findAssignments.mockResolvedValue([
      assignment({ route: route({ items: [item({ contacts: [contactRow()] })] }) }),
    ]);
    findCenterContactLinks.mockResolvedValue([]);

    const [summary] = await getRoutesForAssignment("admin-1", "ADMIN");
    expect(summary?.items[0]?.contacts[0]).toMatchObject({ issue: "NOT_ASSOCIATED" });
  });

  it("flags an inactive contact and leaves a healthy one unflagged", async () => {
    findAssignments.mockResolvedValue([
      assignment({
        route: route({
          items: [
            item({
              contacts: [
                contactRow({
                  id: "rc-1",
                  contactId: "contact-1",
                  contact: { id: "contact-1", name: "A", code: "C1", status: "INACTIVE" },
                }),
                contactRow({
                  id: "rc-2",
                  contactId: "contact-2",
                  contact: { id: "contact-2", name: "B", code: "C2", status: "ACTIVE" },
                }),
              ],
            }),
          ],
        }),
      }),
    ]);
    findCenterContactLinks.mockResolvedValue([
      link("center-1", "contact-1"),
      link("center-1", "contact-2"),
    ]);

    const [summary] = await getRoutesForAssignment("admin-1", "ADMIN");
    expect(summary?.items[0]?.contacts[0]).toMatchObject({ issue: "INACTIVE" });
    expect(summary?.items[0]?.contacts[1]).toMatchObject({ issue: null });
  });
});

describe("searchCentersForRoute", () => {
  it("searches only the actor's permitted territories on a new route", async () => {
    searchActiveCentersInTerritories.mockResolvedValue([]);

    await searchCentersForRoute({ q: "", limit: 20 } as never, "creator-1", "SUPERVISOR");
    expect(searchActiveCentersInTerritories).toHaveBeenCalledWith(
      expect.objectContaining({ territoryIds: ["territory-1"] }),
    );
  });

  it("scopes to the route's assignee when editing an assigned route, after authorizing the actor", async () => {
    findRouteById.mockResolvedValue(route());
    findActiveAssignmentsForRoute.mockResolvedValue([{ userId: "delegate-1" }]);
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);
    listAssignmentsForUser.mockResolvedValue([{ territoryId: "delegate-territory" }]);
    searchActiveCentersInTerritories.mockResolvedValue([]);

    await searchCentersForRoute(
      { q: "", limit: 20, routeId: "route-1" } as never,
      "supervisor-1",
      "SUPERVISOR",
    );
    expect(searchActiveCentersInTerritories).toHaveBeenCalledWith(
      expect.objectContaining({ territoryIds: ["delegate-territory"] }),
    );
  });

  it("rejects a route the actor can't act on", async () => {
    findRouteById.mockResolvedValue(route());

    await expect(
      searchCentersForRoute(
        { q: "", limit: 20, routeId: "route-1" } as never,
        "someone-else",
        "SUPERVISOR",
      ),
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
    searchContactsForCenter.mockResolvedValue([]);

    await searchContactsForRouteCenter(
      "center-1",
      { q: "", limit: 20 } as never,
      "creator-1",
      "SUPERVISOR",
    );
    expect(searchContactsForCenter).toHaveBeenCalledWith(
      expect.objectContaining({ centerId: "center-1" }),
    );
  });

  it("rejects a center outside the actor's territories without searching", async () => {
    findCenterById.mockResolvedValue({
      id: "center-1",
      territoryId: "other-territory",
      status: "ACTIVE",
    });

    await expect(
      searchContactsForRouteCenter(
        "center-1",
        { q: "", limit: 20 } as never,
        "creator-1",
        "SUPERVISOR",
      ),
    ).rejects.toThrow(CenterOutsideTerritoryError);
    expect(searchContactsForCenter).not.toHaveBeenCalled();
  });

  it("rejects an unknown or inactive center", async () => {
    findCenterById.mockResolvedValue(null);

    await expect(
      searchContactsForRouteCenter(
        "center-1",
        { q: "", limit: 20 } as never,
        "creator-1",
        "SUPERVISOR",
      ),
    ).rejects.toThrow(CenterNotFoundError);
  });
});
