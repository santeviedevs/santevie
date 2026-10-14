import { beforeEach, describe, expect, it, vi } from "vitest";

const createFollowUpRow = vi.fn();
const completeFollowUpRow = vi.fn();
const findPendingFollowUpsForUser = vi.fn();
const findPendingFollowUps = vi.fn();
const findFollowUpById = vi.fn();
const updateFollowUpOwnerRow = vi.fn();
const createFollowUpReassignmentRow = vi.fn();
const findReassignmentsForFollowUp = vi.fn();
const listFollowUps = vi.fn();
const countFollowUps = vi.fn();
const runInTransaction = vi.fn();
vi.mock("@/server/repositories/follow-up-repository", () => ({
  createFollowUpRow,
  completeFollowUpRow,
  findFollowUpById,
  findPendingFollowUpsForUser,
  findPendingFollowUps,
  updateFollowUpOwnerRow,
  createFollowUpReassignmentRow,
  findReassignmentsForFollowUp,
  listFollowUps,
  countFollowUps,
  runInTransaction: (fn: (tx: unknown) => unknown) => runInTransaction(fn),
}));

const getUserScope = vi.fn();
const isWithinScope = vi.fn();
const scopeUserIds = vi.fn();
vi.mock("@/server/scope", async () => {
  const actual = await vi.importActual<typeof import("@/server/scope")>("@/server/scope");
  return { ...actual, getUserScope, isWithinScope, scopeUserIds };
});

// assertAssigneeInScope (reused from activity-service.ts, real
// implementation — see below) reads the candidate user through this
// repository; mocked so reassignFollowUp's tests don't hit a real DB.
const findUserById = vi.fn();
vi.mock("@/server/repositories/user-repository", () => ({ findUserById }));

// The ownership rule itself (for createFollowUp) is covered in
// activity-service.test.ts; here it is only a gate that either lets the
// call through or throws. assertAssigneeInScope is reused as-is (real
// implementation) since reassignFollowUp's tests exercise it directly.
const getAssignmentForAction = vi.fn();
vi.mock("./activity-service", async () => {
  const actual = await vi.importActual<typeof import("./activity-service")>("./activity-service");
  return { ...actual, getAssignmentForAction };
});

const {
  completeFollowUp,
  createFollowUp,
  getMyFollowUps,
  getMyFollowUpsPage,
  getTeamFollowUps,
  getTeamFollowUpsPage,
  reassignFollowUp,
} = await import("./follow-up-service");
const { ActivityNotAuthorizedError, AssignmentNotActionableError, AssignmentNotFoundError } =
  await import("./activity-service");

const NOW = new Date("2026-06-15T12:00:00.000Z");

function followUp(overrides: Record<string, unknown> = {}) {
  return {
    id: "f-1",
    dueDate: new Date("2026-06-14T00:00:00.000Z"),
    status: "PENDING",
    ownerId: "owner-1",
    owner: { id: "owner-1", name: "Owner" },
    outcome: null,
    prescriptionsGenerated: null,
    businessValueGenerated: null,
    productAvailable: null,
    seriesIntervalDays: null,
    seriesEndDate: null,
    participantResult: null,
    assignment: {
      id: "assignment-1",
      userId: "owner-1",
      activity: {
        id: "activity-1",
        name: "Spring campaign",
        type: { id: "type-campaign", code: "CAMPAIGN", name: "Campaign" },
        center: null,
        territory: null,
      },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  runInTransaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
});

describe("getMyFollowUps overdue calculation", () => {
  it("a follow-up due yesterday with PENDING status counts as overdue", async () => {
    findPendingFollowUpsForUser.mockResolvedValue([
      followUp({ id: "f-1", dueDate: new Date("2026-06-14T00:00:00.000Z") }),
    ]);

    const { pending, overdue } = await getMyFollowUps("owner-1", NOW);

    expect(pending).toHaveLength(1);
    expect(overdue).toHaveLength(1);
    expect(overdue[0]?.id).toBe("f-1");
  });

  it("a follow-up due tomorrow does not count as overdue, but is still pending", async () => {
    findPendingFollowUpsForUser.mockResolvedValue([
      followUp({ id: "f-2", dueDate: new Date("2026-06-16T00:00:00.000Z") }),
    ]);

    const { pending, overdue } = await getMyFollowUps("owner-1", NOW);

    expect(pending).toHaveLength(1);
    expect(overdue).toHaveLength(0);
  });

  it("a DONE follow-up never appears — the repository query itself already excludes it", async () => {
    findPendingFollowUpsForUser.mockResolvedValue([]);

    const { pending, overdue } = await getMyFollowUps("owner-1", NOW);

    expect(pending).toHaveLength(0);
    expect(overdue).toHaveLength(0);
  });
});

describe("getTeamFollowUps scope enforcement and overdue split", () => {
  it("scopes to the viewer's downstream team, not every follow-up in the system", async () => {
    getUserScope.mockResolvedValue({ kind: "ids", userIds: ["supervisor-1", "report-1"] });
    scopeUserIds.mockReturnValue(["supervisor-1", "report-1"]);
    findPendingFollowUps.mockResolvedValue([
      followUp({ id: "f-1", ownerId: "report-1", dueDate: new Date("2026-06-14T00:00:00.000Z") }),
    ]);

    await getTeamFollowUps({ user: { id: "supervisor-1", roleName: "SUPERVISOR" } }, NOW);

    expect(findPendingFollowUps).toHaveBeenCalledWith(["supervisor-1", "report-1"]);
  });

  it("returns every pending follow-up, not just overdue ones — a manager needs to find and reassign before something goes late", async () => {
    getUserScope.mockResolvedValue({ kind: "ids", userIds: ["manager-1", "report-1"] });
    scopeUserIds.mockReturnValue(["manager-1", "report-1"]);
    findPendingFollowUps.mockResolvedValue([
      followUp({
        id: "f-overdue",
        ownerId: "report-1",
        dueDate: new Date("2026-06-14T00:00:00.000Z"),
      }),
      followUp({
        id: "f-upcoming",
        ownerId: "report-1",
        dueDate: new Date("2026-06-20T00:00:00.000Z"),
      }),
    ]);

    const { pending, overdue } = await getTeamFollowUps(
      { user: { id: "manager-1", roleName: "MANAGER" } },
      NOW,
    );

    expect(pending.map((f) => f.id)).toEqual(["f-overdue", "f-upcoming"]);
    expect(overdue.map((f) => f.id)).toEqual(["f-overdue"]);
  });

  it("passes undefined through for an unrestricted scope (ADMIN), never a manufactured list", async () => {
    getUserScope.mockResolvedValue({ kind: "all" });
    scopeUserIds.mockReturnValue(undefined);
    findPendingFollowUps.mockResolvedValue([]);

    await getTeamFollowUps({ user: { id: "admin-1", roleName: "ADMIN" } }, NOW);

    expect(findPendingFollowUps).toHaveBeenCalledWith(undefined);
  });
});

describe("createFollowUp", () => {
  const MANAGER = { user: { id: "manager-1", roleName: "MANAGER" } };

  it("creates the follow-up owned by the assignee, against the given assignment", async () => {
    getAssignmentForAction.mockResolvedValue({
      id: "assignment-1",
      status: "PLANNED",
      user: { id: "delegate-1" },
    });
    createFollowUpRow.mockResolvedValue(
      followUp({ id: "f-1", ownerId: "delegate-1", owner: { id: "delegate-1", name: "D" } }),
    );

    await createFollowUp({ assignmentId: "assignment-1", dueDate: "2026-06-20" }, MANAGER, true);

    const data = createFollowUpRow.mock.calls[0]![0];
    expect(data.assignment).toEqual({ connect: { id: "assignment-1" } });
    expect(data.owner).toEqual({ connect: { id: "delegate-1" } });
    expect(data.createdBy).toBe("manager-1");
  });

  it("refuses a follow-up on an assignment that's no longer planned", async () => {
    getAssignmentForAction.mockResolvedValue({ id: "assignment-1", status: "CANCELLED" });

    await expect(
      createFollowUp({ assignmentId: "assignment-1", dueDate: "2026-06-20" }, MANAGER, true),
    ).rejects.toBeInstanceOf(AssignmentNotActionableError);
    expect(createFollowUpRow).not.toHaveBeenCalled();
  });

  it("propagates the ownership check failing", async () => {
    getAssignmentForAction.mockRejectedValue(new ActivityNotAuthorizedError());

    await expect(
      createFollowUp({ assignmentId: "assignment-1", dueDate: "2026-06-20" }, MANAGER, false),
    ).rejects.toBeInstanceOf(ActivityNotAuthorizedError);
  });
});

describe("completeFollowUp", () => {
  it("lets the follow-up's current owner complete it, capturing the outcome", async () => {
    findFollowUpById.mockResolvedValue(followUp({ status: "PENDING", ownerId: "owner-1" }));
    completeFollowUpRow.mockResolvedValue(followUp({ status: "DONE", ownerId: "owner-1" }));

    await completeFollowUp(
      { id: "f-1", outcome: "Doctor confirmed uptake", prescriptionsGenerated: 4 },
      "owner-1",
    );

    expect(completeFollowUpRow).toHaveBeenCalledWith(
      "f-1",
      "owner-1",
      expect.objectContaining({ outcome: "Doctor confirmed uptake", prescriptionsGenerated: 4 }),
      {},
    );
  });

  it("blocks anyone who isn't the current owner, by id", async () => {
    findFollowUpById.mockResolvedValue(followUp({ status: "PENDING", ownerId: "owner-1" }));

    await expect(completeFollowUp({ id: "f-1" }, "someone-else")).rejects.toBeInstanceOf(
      ActivityNotAuthorizedError,
    );
    expect(completeFollowUpRow).not.toHaveBeenCalled();
  });

  it("reports a missing follow-up", async () => {
    findFollowUpById.mockResolvedValue(null);

    await expect(completeFollowUp({ id: "missing" }, "owner-1")).rejects.toBeInstanceOf(
      AssignmentNotFoundError,
    );
  });

  it("is a no-op for a follow-up that's already done — no double-advance on a duplicate submit", async () => {
    findFollowUpById.mockResolvedValue(followUp({ status: "DONE", ownerId: "owner-1" }));

    const result = await completeFollowUp({ id: "f-1" }, "owner-1");

    expect(completeFollowUpRow).not.toHaveBeenCalled();
    expect(createFollowUpRow).not.toHaveBeenCalled();
    expect(result.status).toBe("DONE");
  });

  // Trigger 2 of the chain engine (§3.5): a completed follow-up with a
  // configured interval advances to its next link, scheduled off the due
  // date rather than the completion timestamp.
  it("cme_chain_advances_by_30_days_from_due_date_not_completion_date", async () => {
    findFollowUpById.mockResolvedValue(
      followUp({
        id: "f-1",
        status: "PENDING",
        ownerId: "owner-1",
        dueDate: new Date("2026-06-04T00:00:00.000Z"),
        seriesIntervalDays: 30,
        seriesEndDate: new Date("2026-08-30T00:00:00.000Z"),
      }),
    );
    completeFollowUpRow.mockResolvedValue(
      followUp({
        id: "f-1",
        status: "DONE",
        ownerId: "owner-1",
        dueDate: new Date("2026-06-04T00:00:00.000Z"),
        seriesIntervalDays: 30,
        seriesEndDate: new Date("2026-08-30T00:00:00.000Z"),
      }),
    );

    // Completed 10 days late — the next link must still be scheduled from
    // the original due date (2026-06-04 + 30 = 2026-07-04), not from
    // "today".
    await completeFollowUp({ id: "f-1" }, "owner-1");

    expect(createFollowUpRow).toHaveBeenCalledTimes(1);
    const data = createFollowUpRow.mock.calls[0]![0];
    expect(data.dueDate).toEqual(new Date("2026-07-04T00:00:00.000Z"));
    expect(data.parentFollowUp).toEqual({ connect: { id: "f-1" } });
    expect(data.seriesIntervalDays).toBe(30);
    expect(data.seriesEndDate).toEqual(new Date("2026-08-30T00:00:00.000Z"));
  });

  it("cme_chain_terminates_when_next_due_exceeds_series_end_date", async () => {
    findFollowUpById.mockResolvedValue(
      followUp({
        id: "f-3",
        status: "PENDING",
        ownerId: "owner-1",
        dueDate: new Date("2026-08-15T00:00:00.000Z"),
        seriesIntervalDays: 30,
        seriesEndDate: new Date("2026-08-30T00:00:00.000Z"),
      }),
    );
    completeFollowUpRow.mockResolvedValue(
      followUp({
        id: "f-3",
        status: "DONE",
        ownerId: "owner-1",
        dueDate: new Date("2026-08-15T00:00:00.000Z"),
        seriesIntervalDays: 30,
        seriesEndDate: new Date("2026-08-30T00:00:00.000Z"),
      }),
    );

    // 2026-08-15 + 30 = 2026-09-14, past the 2026-08-30 series end — chain
    // stops, no child created.
    await completeFollowUp({ id: "f-3" }, "owner-1");

    expect(createFollowUpRow).not.toHaveBeenCalled();
  });

  it("duplicate_completion_creates_only_one_child", async () => {
    findFollowUpById.mockResolvedValue(
      followUp({
        id: "f-1",
        status: "PENDING",
        ownerId: "owner-1",
        dueDate: new Date("2026-06-04T00:00:00.000Z"),
        seriesIntervalDays: 30,
        seriesEndDate: new Date("2026-08-30T00:00:00.000Z"),
      }),
    );
    completeFollowUpRow.mockResolvedValue(
      followUp({
        id: "f-1",
        status: "DONE",
        ownerId: "owner-1",
        dueDate: new Date("2026-06-04T00:00:00.000Z"),
        seriesIntervalDays: 30,
        seriesEndDate: new Date("2026-08-30T00:00:00.000Z"),
      }),
    );
    // A concurrent transaction already created the child — the DB's
    // unique parentFollowUpId constraint rejects this one with P2002.
    // advanceFollowUpChain must swallow it, not bubble a raw error.
    createFollowUpRow.mockRejectedValueOnce({ code: "P2002" });

    const result = await completeFollowUp({ id: "f-1" }, "owner-1");

    expect(createFollowUpRow).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("DONE");
  });

  it("propagates a non-constraint error from chain creation, rather than swallowing it", async () => {
    findFollowUpById.mockResolvedValue(
      followUp({
        id: "f-1",
        status: "PENDING",
        ownerId: "owner-1",
        dueDate: new Date("2026-06-04T00:00:00.000Z"),
        seriesIntervalDays: 30,
        seriesEndDate: new Date("2026-08-30T00:00:00.000Z"),
      }),
    );
    completeFollowUpRow.mockResolvedValue(
      followUp({
        id: "f-1",
        status: "DONE",
        ownerId: "owner-1",
        dueDate: new Date("2026-06-04T00:00:00.000Z"),
        seriesIntervalDays: 30,
        seriesEndDate: new Date("2026-08-30T00:00:00.000Z"),
      }),
    );
    createFollowUpRow.mockRejectedValueOnce(new Error("connection reset"));

    await expect(completeFollowUp({ id: "f-1" }, "owner-1")).rejects.toThrow("connection reset");
  });
});

describe("reassignFollowUp", () => {
  const MANAGER = { user: { id: "manager-1", roleName: "MANAGER" } };

  it("reassigned_followup_chain_inherits_new_owner", async () => {
    findFollowUpById.mockResolvedValue(followUp({ id: "f-1", ownerId: "owner-1" }));
    getUserScope.mockResolvedValue({ kind: "ids", userIds: ["manager-1", "owner-1", "owner-2"] });
    isWithinScope.mockImplementation(
      (scope: { userIds?: string[] }, userId: string) =>
        scope.userIds === undefined || scope.userIds.includes(userId),
    );
    findUserById.mockResolvedValue({ id: "owner-2", status: "ACTIVE" });
    updateFollowUpOwnerRow.mockResolvedValue(followUp({ id: "f-1", ownerId: "owner-2" }));

    const result = await reassignFollowUp({ id: "f-1", newOwnerId: "owner-2" }, MANAGER);

    expect(updateFollowUpOwnerRow).toHaveBeenCalledWith("f-1", "owner-2", "manager-1", {});
    expect(createFollowUpReassignmentRow).toHaveBeenCalledWith(
      expect.objectContaining({
        followUp: { connect: { id: "f-1" } },
        previousOwner: { connect: { id: "owner-1" } },
        newOwner: { connect: { id: "owner-2" } },
        reassignedByUser: { connect: { id: "manager-1" } },
      }),
      {},
    );
    expect(result.ownerId).toBe("owner-2");

    // A later chain link reads ownerId off the parent at the moment of ITS
    // completion — since reassignment updates the row in place (not a
    // separate "pending owner" field), the next createFollowUpRow call for
    // this chain will naturally pick up "owner-2" as the new owner,
    // without any extra propagation step.
  });

  it("blocks reassigning a follow-up outside the actor's scope", async () => {
    findFollowUpById.mockResolvedValue(followUp({ id: "f-1", ownerId: "outside-1" }));
    getUserScope.mockResolvedValue({ kind: "ids", userIds: ["manager-1", "owner-1"] });
    isWithinScope.mockReturnValue(false);

    await expect(
      reassignFollowUp({ id: "f-1", newOwnerId: "owner-2" }, MANAGER),
    ).rejects.toBeInstanceOf(ActivityNotAuthorizedError);
    expect(updateFollowUpOwnerRow).not.toHaveBeenCalled();
  });

  it("reports a missing follow-up", async () => {
    findFollowUpById.mockResolvedValue(null);

    await expect(
      reassignFollowUp({ id: "missing", newOwnerId: "owner-2" }, MANAGER),
    ).rejects.toBeInstanceOf(AssignmentNotFoundError);
  });
});

const PAGE = { page: 2, pageSize: 5 };

describe("getMyFollowUpsPage", () => {
  beforeEach(() => {
    listFollowUps.mockResolvedValue([]);
    countFollowUps.mockResolvedValue(0);
  });

  it("scopes strictly to the viewer's own ownerId, pages, and applies filters", async () => {
    countFollowUps.mockResolvedValue(12);

    const result = await getMyFollowUpsPage("owner-1", PAGE, { q: "rtm", typeId: "type-rtm" });

    expect(listFollowUps).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerScopeUserIds: ["owner-1"],
        q: "rtm",
        typeId: "type-rtm",
        skip: 5,
        take: 5,
      }),
    );
    expect(countFollowUps).toHaveBeenCalledWith(
      expect.objectContaining({ ownerScopeUserIds: ["owner-1"], q: "rtm", typeId: "type-rtm" }),
    );
    expect(result.total).toBe(12);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(5);
  });

  it("passes overdueOnly and asOf through for the overdue-only filter", async () => {
    const asOf = new Date("2026-06-15T00:00:00.000Z");

    await getMyFollowUpsPage("owner-1", PAGE, { overdueOnly: true }, asOf);

    expect(listFollowUps).toHaveBeenCalledWith(
      expect.objectContaining({ overdueOnly: true, asOf }),
    );
  });

  it("extends a `to` date to end-of-day, same convention as activity list filters", async () => {
    await getMyFollowUpsPage("owner-1", PAGE, { from: "2026-06-01", to: "2026-06-30" });

    const query = listFollowUps.mock.calls[0]![0];
    expect(query.from).toEqual(new Date("2026-06-01"));
    expect(query.to).toEqual(new Date("2026-06-30T23:59:59.999Z"));
  });

  it("defaults to every status — the table doubles as completed-follow-up history", async () => {
    await getMyFollowUpsPage("owner-1", PAGE);

    const query = listFollowUps.mock.calls[0]![0];
    expect(query.status).toBeUndefined();
  });

  it("passes an explicit status filter through unchanged", async () => {
    await getMyFollowUpsPage("owner-1", PAGE, { status: "DONE" });

    expect(listFollowUps).toHaveBeenCalledWith(expect.objectContaining({ status: "DONE" }));
  });
});

describe("getTeamFollowUpsPage", () => {
  beforeEach(() => {
    listFollowUps.mockResolvedValue([]);
    countFollowUps.mockResolvedValue(0);
  });

  it("scopes to the viewer's downstream team, not just their own follow-ups", async () => {
    getUserScope.mockResolvedValue({ kind: "ids", userIds: ["manager-1", "report-1"] });
    scopeUserIds.mockReturnValue(["manager-1", "report-1"]);

    await getTeamFollowUpsPage({ user: { id: "manager-1", roleName: "MANAGER" } }, PAGE);

    expect(listFollowUps).toHaveBeenCalledWith(
      expect.objectContaining({ ownerScopeUserIds: ["manager-1", "report-1"] }),
    );
  });

  it("passes undefined through for an unrestricted scope (ADMIN), never a manufactured list", async () => {
    getUserScope.mockResolvedValue({ kind: "all" });
    scopeUserIds.mockReturnValue(undefined);

    await getTeamFollowUpsPage({ user: { id: "admin-1", roleName: "ADMIN" } }, PAGE);

    expect(listFollowUps).toHaveBeenCalledWith(
      expect.objectContaining({ ownerScopeUserIds: undefined }),
    );
  });
});
