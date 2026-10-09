import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findCenterById = vi.fn();
vi.mock("@/server/repositories/center-repository", () => ({ findCenterById }));

const assignPlanRow = vi.fn();
const cancelPendingPlanItems = vi.fn();
const createPlanItem = vi.fn();
const createPlanRow = vi.fn();
const deletePlanItem = vi.fn();
const deletePlanRow = vi.fn();
const findActiveCenterIdsForVisitorOnDate = vi.fn();
const findAssignablePlans = vi.fn();
const findEditablePlans = vi.fn();
const findPlanById = vi.fn();
const findPlanItemById = vi.fn();
const findPlansForVisitor = vi.fn();
const movePlanItems = vi.fn();
const updatePlanItemSequence = vi.fn();
const updatePlanItemStatus = vi.fn();
vi.mock("@/server/repositories/plan-repository", () => ({
  assignPlanRow,
  cancelPendingPlanItems,
  createPlanItem,
  createPlanRow,
  deletePlanItem,
  deletePlanRow,
  findActiveCenterIdsForVisitorOnDate,
  findAssignablePlans,
  findEditablePlans,
  findPlanById,
  findPlanItemById,
  findPlansForVisitor,
  movePlanItems,
  updatePlanItemSequence,
  updatePlanItemStatus,
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
  savePlanContent,
  reorderPlanItems,
  completePlanItem,
  cancelPlanItem,
  assignPlan,
  cancelPlanAssignment,
  getPlansForContent,
  getMyVisits,
  PlanEditCutoffError,
  CenterOutsideTerritoryError,
  DuplicateCenterOnPlanError,
  PlanNotAuthorizedError,
  PlanNotOwnedError,
  PlanHasCompletedItemsError,
} = await import("./plan-service");

const TODAY = new Date("2026-06-15T00:00:00.000Z");
const TOMORROW = new Date("2026-06-16T00:00:00.000Z");
const YESTERDAY = new Date("2026-06-14T00:00:00.000Z");

function plan(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-1",
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
  createPlanRow.mockResolvedValue({ id: "plan-1" });
  createPlanItem.mockResolvedValue({ id: "item-1", sequence: 0, status: "PENDING" });
  getDownstreamUserIds.mockResolvedValue([]);
  findActiveCenterIdsForVisitorOnDate.mockResolvedValue(new Set());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("savePlanContent — creation", () => {
  it("creates a bare plan when planId is null and saves the draft's centers onto it", async () => {
    findCenterById.mockResolvedValue({ id: "center-1", territoryId: "territory-1" });

    await expect(savePlanContent(null, ["center-1"], "creator-1", "SUPERVISOR")).resolves.toBe(
      "plan-1",
    );
    expect(createPlanRow).toHaveBeenCalledWith("creator-1");
    expect(createPlanItem).toHaveBeenCalledWith(expect.objectContaining({ sequence: 0 }));
  });

  it("never looks up an existing plan when planId is null", async () => {
    findCenterById.mockResolvedValue({ id: "center-1", territoryId: "territory-1" });

    await savePlanContent(null, ["center-1"], "creator-1", "SUPERVISOR");
    expect(findPlanById).not.toHaveBeenCalled();
  });
});

describe("savePlanContent — authorization", () => {
  it("allows the creator to save their own unassigned plan", async () => {
    findPlanById.mockResolvedValue(plan());

    await expect(savePlanContent("plan-1", [], "creator-1", "SUPERVISOR")).resolves.toBe("plan-1");
  });

  it("rejects someone else saving a still-unassigned plan they didn't create", async () => {
    findPlanById.mockResolvedValue(plan());

    await expect(savePlanContent("plan-1", [], "someone-else", "SUPERVISOR")).rejects.toThrow(
      PlanNotAuthorizedError,
    );
  });

  it("allows ADMIN to save anyone's unassigned plan", async () => {
    findPlanById.mockResolvedValue(plan());

    await expect(savePlanContent("plan-1", [], "admin-1", "ADMIN")).resolves.toBe("plan-1");
  });

  it("allows a chain-assignor to save an already-assigned plan", async () => {
    findPlanById.mockResolvedValue(plan({ userId: "delegate-1", date: TOMORROW }));
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await expect(savePlanContent("plan-1", [], "supervisor-1", "SUPERVISOR")).resolves.toBe(
      "plan-1",
    );
  });

  it("rejects saving once the assigned plan's date has started", async () => {
    findPlanById.mockResolvedValue(plan({ userId: "delegate-1", date: TODAY }));

    await expect(savePlanContent("plan-1", [], "delegate-1", "DELEGATE")).rejects.toThrow(
      PlanEditCutoffError,
    );
  });

  it("never gates an unassigned plan by the edit cutoff", async () => {
    findPlanById.mockResolvedValue(plan());

    await expect(savePlanContent("plan-1", [], "creator-1", "SUPERVISOR")).resolves.toBe("plan-1");
  });
});

describe("savePlanContent — territory and duplicate validation", () => {
  it("validates new centers against the creator's territories while unassigned", async () => {
    findPlanById.mockResolvedValue(plan());
    findCenterById.mockResolvedValue({ id: "center-1", territoryId: "territory-outside" });

    await expect(
      savePlanContent("plan-1", ["center-1"], "creator-1", "SUPERVISOR"),
    ).rejects.toThrow(CenterOutsideTerritoryError);
  });

  it("validates new centers against the visitor's territories once assigned", async () => {
    findPlanById.mockResolvedValue(plan({ userId: "delegate-1", date: TOMORROW }));
    listAssignmentsForUser.mockResolvedValue([]);
    findUserById.mockResolvedValue({ territoryId: "delegate-territory" });
    findCenterById.mockResolvedValue({ id: "center-1", territoryId: "territory-1" });

    await expect(savePlanContent("plan-1", ["center-1"], "delegate-1", "DELEGATE")).rejects.toThrow(
      CenterOutsideTerritoryError,
    );
  });

  it("rejects a new center already active for this visitor on this date on a different plan", async () => {
    findPlanById.mockResolvedValue(plan({ userId: "delegate-1", date: TOMORROW }));
    findActiveCenterIdsForVisitorOnDate.mockResolvedValue(new Set(["center-1"]));
    findCenterById.mockResolvedValue({ id: "center-1", territoryId: "territory-1" });

    await expect(savePlanContent("plan-1", ["center-1"], "delegate-1", "DELEGATE")).rejects.toThrow(
      DuplicateCenterOnPlanError,
    );
  });

  it("never runs the cross-plan duplicate check while unassigned (no date to check against)", async () => {
    findPlanById.mockResolvedValue(plan());
    findCenterById.mockResolvedValue({ id: "center-1", territoryId: "territory-1" });

    await savePlanContent("plan-1", ["center-1"], "creator-1", "SUPERVISOR");
    expect(findActiveCenterIdsForVisitorOnDate).not.toHaveBeenCalled();
  });
});

describe("savePlanContent — diffing against existing items", () => {
  it("removes a PENDING item no longer in the desired list", async () => {
    findPlanById.mockResolvedValue(plan({ items: [item()] }));

    await savePlanContent("plan-1", [], "creator-1", "SUPERVISOR");
    expect(deletePlanItem).toHaveBeenCalledWith("item-1");
  });

  it("resequences a kept item instead of recreating it", async () => {
    findPlanById.mockResolvedValue(plan({ items: [item()] }));

    await savePlanContent("plan-1", ["center-1"], "creator-1", "SUPERVISOR");
    expect(updatePlanItemSequence).toHaveBeenCalledWith("item-1", 0, "creator-1");
    expect(createPlanItem).not.toHaveBeenCalled();
    expect(deletePlanItem).not.toHaveBeenCalled();
  });

  it("creates new items only for centers not already on the plan", async () => {
    findPlanById.mockResolvedValue(plan({ items: [item()] }));
    findCenterById.mockResolvedValue({ id: "center-2", territoryId: "territory-1" });

    await savePlanContent("plan-1", ["center-1", "center-2"], "creator-1", "SUPERVISOR");
    expect(updatePlanItemSequence).toHaveBeenCalledWith("item-1", 0, "creator-1");
    expect(createPlanItem).toHaveBeenCalledWith(expect.objectContaining({ sequence: 1 }));
  });

  it("never touches a COMPLETED or CANCELLED item even if it's left out of the desired list", async () => {
    findPlanById.mockResolvedValue(
      plan({
        userId: "delegate-1",
        date: TOMORROW,
        items: [item({ status: "COMPLETED" })],
      }),
    );

    await savePlanContent("plan-1", [], "delegate-1", "DELEGATE");
    expect(deletePlanItem).not.toHaveBeenCalled();
  });
});

describe("reorderPlanItems", () => {
  it("is never gated by the edit cutoff, even on an assigned, already-started plan", async () => {
    findPlanById.mockResolvedValue(plan({ userId: "delegate-1", date: TODAY }));

    await reorderPlanItems("plan-1", ["item-1"], "delegate-1", "DELEGATE");
    expect(updatePlanItemSequence).toHaveBeenCalledWith("item-1", 0, "delegate-1");
  });
});

describe("completePlanItem / cancelPlanItem", () => {
  it("completePlanItem rejects anyone but the visitor, even an in-chain supervisor", async () => {
    findPlanItemById.mockResolvedValue({ id: "item-1", plan: { userId: "delegate-1" } });

    await expect(completePlanItem("item-1", "supervisor-1")).rejects.toThrow(PlanNotOwnedError);
  });

  it("cancelPlanItem rejects acting on a still-unassigned plan's item (nothing to cancel yet)", async () => {
    findPlanItemById.mockResolvedValue({ id: "item-1", plan: plan() });

    await expect(cancelPlanItem("item-1", "creator-1", "SUPERVISOR")).rejects.toThrow(
      PlanNotAuthorizedError,
    );
  });
});

describe("assignPlan — first-time assignment", () => {
  it("assigns an unassigned plan in place", async () => {
    findPlanById.mockResolvedValue(plan({ items: [item()] }));
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await expect(
      assignPlan("plan-1", "delegate-1", TOMORROW, "supervisor-1", "SUPERVISOR"),
    ).resolves.toBe("plan-1");
    expect(assignPlanRow).toHaveBeenCalledWith("plan-1", "delegate-1", TOMORROW, "supervisor-1");
    expect(createPlanRow).not.toHaveBeenCalled();
  });

  it("rejects assigning to a target outside the actor's downstream chain", async () => {
    findPlanById.mockResolvedValue(plan());
    getDownstreamUserIds.mockResolvedValue([]);

    await expect(
      assignPlan("plan-1", "someone-else", TOMORROW, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(PlanNotAuthorizedError);
    expect(assignPlanRow).not.toHaveBeenCalled();
  });

  it("validates every item's territory against the target before assigning", async () => {
    findPlanById.mockResolvedValue(
      plan({ items: [item({ center: { id: "center-1", territoryId: "other-territory" } })] }),
    );
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await expect(
      assignPlan("plan-1", "delegate-1", TOMORROW, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(CenterOutsideTerritoryError);
    expect(assignPlanRow).not.toHaveBeenCalled();
  });

  it("validates no item is already planned for the target on that date elsewhere", async () => {
    findPlanById.mockResolvedValue(plan({ items: [item()] }));
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);
    findActiveCenterIdsForVisitorOnDate.mockResolvedValue(new Set(["center-1"]));

    await expect(
      assignPlan("plan-1", "delegate-1", TOMORROW, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(DuplicateCenterOnPlanError);
  });
});

describe("assignPlan — reassignment", () => {
  it("creates a new plan, moves items, and deletes the source — never updates in place", async () => {
    findPlanById.mockResolvedValue(
      plan({ id: "old-plan", userId: "delegate-1", date: TOMORROW, items: [item()] }),
    );
    createPlanRow.mockResolvedValue({ id: "new-plan" });
    getDownstreamUserIds.mockResolvedValue(["delegate-1", "delegate-2"]);

    const result = await assignPlan(
      "old-plan",
      "delegate-2",
      TOMORROW,
      "supervisor-1",
      "SUPERVISOR",
    );

    expect(result).toBe("new-plan");
    expect(createPlanRow).toHaveBeenCalledWith("supervisor-1");
    expect(assignPlanRow).toHaveBeenCalledWith("new-plan", "delegate-2", TOMORROW, "supervisor-1");
    expect(movePlanItems).toHaveBeenCalledWith("old-plan", "new-plan");
    expect(deletePlanRow).toHaveBeenCalledWith("old-plan");
  });

  it("refuses to reassign a plan with any COMPLETED item", async () => {
    findPlanById.mockResolvedValue(
      plan({
        id: "old-plan",
        userId: "delegate-1",
        date: TOMORROW,
        items: [item({ status: "COMPLETED" }), item({ id: "item-2", status: "PENDING" })],
      }),
    );
    getDownstreamUserIds.mockResolvedValue(["delegate-1", "delegate-2"]);

    await expect(
      assignPlan("old-plan", "delegate-2", TOMORROW, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(PlanHasCompletedItemsError);
    expect(createPlanRow).not.toHaveBeenCalled();
    expect(movePlanItems).not.toHaveBeenCalled();
  });
});

describe("cancelPlanAssignment", () => {
  it("bulk-cancels every still-PENDING item, authorized the same as any other plan action", async () => {
    findPlanById.mockResolvedValue(plan({ userId: "delegate-1", date: TOMORROW }));
    getDownstreamUserIds.mockResolvedValue(["delegate-1"]);

    await cancelPlanAssignment("plan-1", "supervisor-1", "SUPERVISOR");
    expect(cancelPendingPlanItems).toHaveBeenCalledWith("plan-1", "supervisor-1");
  });

  it("does nothing for a still-unassigned plan", async () => {
    findPlanById.mockResolvedValue(plan());

    await cancelPlanAssignment("plan-1", "creator-1", "SUPERVISOR");
    expect(cancelPendingPlanItems).not.toHaveBeenCalled();
  });
});

describe("getPlansForContent / getMyVisits — MISSED is computed, never stored", () => {
  it("displays a PENDING item as MISSED once its plan date has passed", async () => {
    findEditablePlans.mockResolvedValue([
      plan({ userId: "delegate-1", date: YESTERDAY, items: [item()] }),
    ]);

    const result = await getPlansForContent("supervisor-1", "SUPERVISOR");
    expect(result[0]?.items[0]?.status).toBe("MISSED");
  });

  it("keeps a PENDING item as PENDING for a future date", async () => {
    findPlansForVisitor.mockResolvedValue([
      plan({ userId: "delegate-1", date: TOMORROW, items: [item()] }),
    ]);

    const result = await getMyVisits("delegate-1");
    expect(result[0]?.items[0]?.status).toBe("PENDING");
  });

  it("never relabels a COMPLETED item as MISSED, even for a past date", async () => {
    findPlansForVisitor.mockResolvedValue([
      plan({ userId: "delegate-1", date: YESTERDAY, items: [item({ status: "COMPLETED" })] }),
    ]);

    const result = await getMyVisits("delegate-1");
    expect(result[0]?.items[0]?.status).toBe("COMPLETED");
  });

  it("an unassigned plan (no date) is never shown as editable=false and never MISSED", async () => {
    findEditablePlans.mockResolvedValue([plan({ items: [item()] })]);

    const result = await getPlansForContent("creator-1", "SUPERVISOR");
    expect(result[0]?.editable).toBe(true);
    expect(result[0]?.items[0]?.status).toBe("PENDING");
  });
});
