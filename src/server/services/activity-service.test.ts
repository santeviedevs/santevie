import { beforeEach, describe, expect, it, vi } from "vitest";

const createActivityRow = vi.fn();
const updateActivityRow = vi.fn();
const findActivityById = vi.fn();
const findAssignmentById = vi.fn();
const findActivePlannedAssignment = vi.fn();
const createAssignmentRow = vi.fn();
const updateAssignmentStatusRow = vi.fn();
const runInTransaction = vi.fn();
const listActivities = vi.fn();
const countActivities = vi.fn();
const listAssignments = vi.fn();
const countAssignments = vi.fn();
const searchActivities = vi.fn();
vi.mock("@/server/repositories/activity-repository", () => ({
  createActivityRow,
  updateActivityRow,
  findActivityById,
  findAssignmentById,
  findActivePlannedAssignment,
  createAssignmentRow,
  updateAssignmentStatusRow,
  runInTransaction: (fn: (tx: unknown) => unknown) => runInTransaction(fn),
  listActivities,
  countActivities,
  listAssignments,
  countAssignments,
  searchActivities,
}));

const findUserById = vi.fn();
const findUserIdsByRoleName = vi.fn();
const findUsersByIds = vi.fn();
const findAllUsersInScope = vi.fn();
const searchActiveUsers = vi.fn();
vi.mock("@/server/repositories/user-repository", () => ({
  findUserById,
  findUserIdsByRoleName,
  findUsersByIds,
  findAllUsersInScope,
  searchActiveUsers,
}));

const getUserScope = vi.fn();
vi.mock("@/server/scope", async () => {
  const actual = await vi.importActual<typeof import("@/server/scope")>("@/server/scope");
  return { ...actual, getUserScope };
});

const {
  ActivityNotAuthorizedError,
  ActivityNotFoundError,
  AssigneeOutsideScopeError,
  AssignmentNotActionableError,
  AssignmentNotFoundError,
  DuplicateAssignmentError,
  createActivity,
  createAssignment,
  reassignAssignment,
  cancelAssignment,
  updateAssignmentStatus,
  getAssignmentsForMonth,
  getActivitiesPageForViewer,
} = await import("./activity-service");

const MANAGER = { user: { id: "manager-1", roleName: "MANAGER" } };
const DELEGATE = { user: { id: "delegate-1", roleName: "DELEGATE" } };
const TEAM_SCOPE = { kind: "ids" as const, userIds: ["manager-1", "delegate-1", "supervisor-1"] };

function activity(overrides: Record<string, unknown> = {}) {
  return {
    id: "activity-1",
    name: "Spring campaign",
    type: "CAMPAIGN",
    notes: null,
    center: null,
    territory: null,
    assignments: [],
    createdBy: "manager-1",
    createdAt: new Date("2026-10-10T00:00:00.000Z"),
    ...overrides,
  };
}

function assignment(overrides: Record<string, unknown> = {}) {
  return {
    id: "assignment-1",
    status: "PLANNED",
    scheduledDate: new Date("2026-10-10T00:00:00.000Z"),
    activityId: "activity-1",
    userId: "delegate-1",
    activity: activity(),
    user: { id: "delegate-1", name: "D" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getUserScope.mockResolvedValue(TEAM_SCOPE);
  findUserIdsByRoleName.mockResolvedValue(["admin-1"]);
  runInTransaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
});

describe("createActivity", () => {
  it("creates the activity unassigned, attributed to the creator", async () => {
    createActivityRow.mockResolvedValue(activity());

    await createActivity(
      { name: "Spring campaign", type: "CAMPAIGN", centerId: "center-1" },
      "manager-1",
    );

    const data = createActivityRow.mock.calls[0]![0];
    expect(data.name).toBe("Spring campaign");
    expect(data.createdBy).toBe("manager-1");
  });
});

describe("createAssignment", () => {
  it("assigns the activity to someone in the manager's team", async () => {
    findActivityById.mockResolvedValue(activity());
    findUserById.mockResolvedValue({ id: "delegate-1", status: "ACTIVE" });
    findActivePlannedAssignment.mockResolvedValue(null);
    createAssignmentRow.mockResolvedValue(assignment());

    const result = await createAssignment(
      { activityId: "activity-1", userId: "delegate-1", scheduledDate: "2026-10-10" },
      MANAGER,
    );

    expect(createAssignmentRow).toHaveBeenCalledWith(
      "activity-1",
      "delegate-1",
      new Date("2026-10-10"),
      "manager-1",
    );
    expect(findUserById).toHaveBeenCalledWith("delegate-1", [...TEAM_SCOPE.userIds]);
    expect(result.user.id).toBe("delegate-1");
  });

  it("lets a manager assign an activity an admin created", async () => {
    findActivityById.mockResolvedValue(activity({ createdBy: "admin-1" }));
    findUserById.mockResolvedValue({ id: "delegate-1", status: "ACTIVE" });
    findActivePlannedAssignment.mockResolvedValue(null);
    createAssignmentRow.mockResolvedValue(assignment());

    await createAssignment(
      { activityId: "activity-1", userId: "delegate-1", scheduledDate: "2026-10-10" },
      MANAGER,
    );

    expect(createAssignmentRow).toHaveBeenCalled();
  });

  it("allows a second, independent assignment to a different user on the same activity", async () => {
    findActivityById.mockResolvedValue(
      activity({ assignments: [{ id: "a-0", status: "PLANNED", user: { id: "delegate-1" } }] }),
    );
    findUserById.mockResolvedValue({ id: "delegate-2", status: "ACTIVE" });
    findActivePlannedAssignment.mockResolvedValue(null);
    createAssignmentRow.mockResolvedValue(assignment({ userId: "delegate-2" }));

    await createAssignment(
      { activityId: "activity-1", userId: "delegate-2", scheduledDate: "2026-10-10" },
      MANAGER,
    );

    expect(createAssignmentRow).toHaveBeenCalledWith(
      "activity-1",
      "delegate-2",
      new Date("2026-10-10"),
      "manager-1",
    );
  });

  it("rejects a duplicate active assignment for the same user", async () => {
    findActivityById.mockResolvedValue(activity());
    findUserById.mockResolvedValue({ id: "delegate-1", status: "ACTIVE" });
    findActivePlannedAssignment.mockResolvedValue({ id: "existing" });

    await expect(
      createAssignment(
        { activityId: "activity-1", userId: "delegate-1", scheduledDate: "2026-10-10" },
        MANAGER,
      ),
    ).rejects.toBeInstanceOf(DuplicateAssignmentError);
    expect(createAssignmentRow).not.toHaveBeenCalled();
  });

  it("rejects an assignee outside the manager's team", async () => {
    findActivityById.mockResolvedValue(activity());
    findUserById.mockResolvedValue(null);

    await expect(
      createAssignment(
        { activityId: "activity-1", userId: "stranger", scheduledDate: "2026-10-10" },
        MANAGER,
      ),
    ).rejects.toBeInstanceOf(AssigneeOutsideScopeError);
    expect(createAssignmentRow).not.toHaveBeenCalled();
  });

  it("rejects an inactive assignee", async () => {
    findActivityById.mockResolvedValue(activity());
    findUserById.mockResolvedValue({ id: "delegate-1", status: "INACTIVE" });

    await expect(
      createAssignment(
        { activityId: "activity-1", userId: "delegate-1", scheduledDate: "2026-10-10" },
        MANAGER,
      ),
    ).rejects.toBeInstanceOf(AssigneeOutsideScopeError);
  });

  it("rejects an activity outside the manager's team", async () => {
    findActivityById.mockResolvedValue(
      activity({
        assignments: [{ id: "a-0", status: "PLANNED", user: { id: "other-1" } }],
        createdBy: "other-mgr",
      }),
    );

    await expect(
      createAssignment(
        { activityId: "activity-1", userId: "delegate-1", scheduledDate: "2026-10-10" },
        MANAGER,
      ),
    ).rejects.toBeInstanceOf(ActivityNotAuthorizedError);
  });

  it("reports a missing activity", async () => {
    findActivityById.mockResolvedValue(null);

    await expect(
      createAssignment(
        { activityId: "missing", userId: "delegate-1", scheduledDate: "2026-10-10" },
        MANAGER,
      ),
    ).rejects.toBeInstanceOf(ActivityNotFoundError);
  });
});

describe("reassignAssignment", () => {
  it("cancels the old assignment and creates a fresh one, leaving others untouched", async () => {
    findAssignmentById.mockResolvedValue(assignment());
    findUserById.mockResolvedValue({ id: "delegate-2", status: "ACTIVE" });
    findActivePlannedAssignment.mockResolvedValue(null);
    createAssignmentRow.mockResolvedValue(assignment({ id: "assignment-2", userId: "delegate-2" }));

    const result = await reassignAssignment(
      { assignmentId: "assignment-1", userId: "delegate-2", scheduledDate: "2026-10-12" },
      MANAGER,
    );

    expect(updateAssignmentStatusRow).toHaveBeenCalledWith(
      "assignment-1",
      "CANCELLED",
      "manager-1",
      {},
    );
    expect(createAssignmentRow).toHaveBeenCalledWith(
      "activity-1",
      "delegate-2",
      new Date("2026-10-12"),
      "manager-1",
      {},
    );
    expect(result.id).toBe("assignment-2");
  });

  it("rejects reassigning one that's no longer planned", async () => {
    findAssignmentById.mockResolvedValue(assignment({ status: "DONE" }));

    await expect(
      reassignAssignment(
        { assignmentId: "assignment-1", userId: "delegate-2", scheduledDate: "2026-10-12" },
        MANAGER,
      ),
    ).rejects.toBeInstanceOf(AssignmentNotActionableError);
  });

  it("reports a missing assignment", async () => {
    findAssignmentById.mockResolvedValue(null);

    await expect(
      reassignAssignment(
        { assignmentId: "missing", userId: "delegate-2", scheduledDate: "2026-10-12" },
        MANAGER,
      ),
    ).rejects.toBeInstanceOf(AssignmentNotFoundError);
  });
});

describe("cancelAssignment", () => {
  it("cancels a planned assignment in scope", async () => {
    findAssignmentById.mockResolvedValue(assignment());

    await cancelAssignment("assignment-1", MANAGER);

    expect(updateAssignmentStatusRow).toHaveBeenCalledWith(
      "assignment-1",
      "CANCELLED",
      "manager-1",
    );
  });

  it("blocks cancelling an assignment outside the manager's team", async () => {
    findAssignmentById.mockResolvedValue(assignment({ user: { id: "other-1" } }));

    await expect(cancelAssignment("assignment-1", MANAGER)).rejects.toBeInstanceOf(
      ActivityNotAuthorizedError,
    );
  });

  it("rejects cancelling one that's already cancelled", async () => {
    findAssignmentById.mockResolvedValue(assignment({ status: "CANCELLED" }));

    await expect(cancelAssignment("assignment-1", MANAGER)).rejects.toBeInstanceOf(
      AssignmentNotActionableError,
    );
  });
});

describe("updateAssignmentStatus", () => {
  it("lets the assignee update their own assignment", async () => {
    getUserScope.mockResolvedValue({ kind: "ids", userIds: ["delegate-1"] });
    findAssignmentById.mockResolvedValue(assignment());
    updateAssignmentStatusRow.mockResolvedValue(assignment({ status: "DONE" }));

    await updateAssignmentStatus("assignment-1", "DONE", DELEGATE, false);

    expect(updateAssignmentStatusRow).toHaveBeenCalledWith("assignment-1", "DONE", "delegate-1");
  });

  it("blocks a delegate from changing someone else's assignment by id", async () => {
    getUserScope.mockResolvedValue({ kind: "ids", userIds: ["delegate-1"] });
    findAssignmentById.mockResolvedValue(assignment({ user: { id: "delegate-2" } }));

    await expect(
      updateAssignmentStatus("assignment-1", "DONE", DELEGATE, false),
    ).rejects.toBeInstanceOf(ActivityNotAuthorizedError);
    expect(updateAssignmentStatusRow).not.toHaveBeenCalled();
  });

  it("blocks a supervisor from changing a downstream delegate's assignment without manager rights", async () => {
    getUserScope.mockResolvedValue({ kind: "ids", userIds: ["supervisor-1", "delegate-1"] });
    findAssignmentById.mockResolvedValue(assignment());

    await expect(
      updateAssignmentStatus(
        "assignment-1",
        "CANCELLED",
        { user: { id: "supervisor-1", roleName: "SUPERVISOR" } },
        false,
      ),
    ).rejects.toBeInstanceOf(ActivityNotAuthorizedError);
  });

  it("lets a manager cancel an assignment in their team", async () => {
    findAssignmentById.mockResolvedValue(assignment());
    updateAssignmentStatusRow.mockResolvedValue(assignment({ status: "CANCELLED" }));

    await updateAssignmentStatus("assignment-1", "CANCELLED", MANAGER, true);

    expect(updateAssignmentStatusRow).toHaveBeenCalled();
  });

  it("rejects updating an assignment that's already done", async () => {
    findAssignmentById.mockResolvedValue(assignment({ status: "DONE" }));

    await expect(
      updateAssignmentStatus("assignment-1", "CANCELLED", MANAGER, true),
    ).rejects.toBeInstanceOf(AssignmentNotActionableError);
  });
});

const PAGE = { page: 2, pageSize: 5 };

describe("getActivitiesPageForViewer", () => {
  beforeEach(() => {
    listActivities.mockResolvedValue([]);
    countActivities.mockResolvedValue(0);
    findUsersByIds.mockResolvedValue([]);
  });

  it("shows a manager their team's activities plus unassigned ones from their team or an admin", async () => {
    await getActivitiesPageForViewer(MANAGER, true, PAGE);

    expect(listActivities).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedScopeUserIds: [...TEAM_SCOPE.userIds],
        unassignedCreatorIds: [...TEAM_SCOPE.userIds, "admin-1"],
      }),
    );
  });

  it("shows everyone else only the activities assigned to themselves", async () => {
    await getActivitiesPageForViewer(
      { user: { id: "supervisor-1", roleName: "SUPERVISOR" } },
      false,
      PAGE,
    );

    const query = listActivities.mock.calls[0]![0];
    expect(query.assignedScopeUserIds).toEqual(["supervisor-1"]);
    expect(query.unassignedCreatorIds).toBeUndefined();
  });

  it("pages the query, counts it with the same filters, and applies them", async () => {
    countActivities.mockResolvedValue(12);

    const result = await getActivitiesPageForViewer(MANAGER, true, PAGE, {
      q: "spring",
      type: "CAMPAIGN",
    });

    expect(listActivities).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5, q: "spring", type: "CAMPAIGN" }),
    );
    const countQuery = countActivities.mock.calls[0]![0];
    expect(countQuery.q).toBe("spring");
    expect(countQuery.skip).toBeUndefined();
    expect(result).toMatchObject({ total: 12, page: 2, pageSize: 5 });
  });
});

describe("getAssignmentsForMonth", () => {
  it("bounds the query to the calendar month, same visibility as the list", async () => {
    listAssignments.mockResolvedValue([]);

    await getAssignmentsForMonth(MANAGER, true, 2026, 9);

    expect(listAssignments).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeUserIds: [...TEAM_SCOPE.userIds],
        from: new Date("2026-10-01T00:00:00.000Z"),
        to: new Date("2026-11-01T00:00:00.000Z"),
      }),
    );
  });

  it("rolls December over into January of the next year", async () => {
    listAssignments.mockResolvedValue([]);

    await getAssignmentsForMonth(DELEGATE, false, 2026, 11);

    const query = listAssignments.mock.calls[0]![0];
    expect(query.from).toEqual(new Date("2026-12-01T00:00:00.000Z"));
    expect(query.to).toEqual(new Date("2027-01-01T00:00:00.000Z"));
    expect(query.scopeUserIds).toEqual(["delegate-1"]);
  });
});
