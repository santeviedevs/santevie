import { beforeEach, describe, expect, it, vi } from "vitest";

const createActivityRow = vi.fn();
const findActivityById = vi.fn();
const assignActivityRow = vi.fn();
const listActivities = vi.fn();
const countActivities = vi.fn();
const updateActivityStatusRow = vi.fn();
vi.mock("@/server/repositories/activity-repository", () => ({
  createActivityRow,
  findActivityById,
  assignActivityRow,
  countActivities,
  listActivities,
  updateActivityStatus: updateActivityStatusRow,
}));

const findUserById = vi.fn();
const findUserIdsByRoleName = vi.fn();
vi.mock("@/server/repositories/user-repository", () => ({ findUserById, findUserIdsByRoleName }));

const getUserScope = vi.fn();
vi.mock("@/server/scope", async () => {
  const actual = await vi.importActual<typeof import("@/server/scope")>("@/server/scope");
  return { ...actual, getUserScope };
});

const {
  ActivityNotAuthorizedError,
  ActivityNotFoundError,
  ActivityNotReassignableError,
  AssigneeOutsideScopeError,
  assignActivity,
  createActivity,
  getActivitiesForMonth,
  getActivitiesPageForViewer,
  updateActivityStatus,
} = await import("./activity-service");

const MANAGER = { user: { id: "manager-1", roleName: "MANAGER" } };
const DELEGATE = { user: { id: "delegate-1", roleName: "DELEGATE" } };
const TEAM_SCOPE = { kind: "ids" as const, userIds: ["manager-1", "delegate-1", "supervisor-1"] };

function activity(overrides: Record<string, unknown> = {}) {
  return {
    id: "activity-1",
    type: "CAMPAIGN",
    date: new Date("2026-10-10T00:00:00.000Z"),
    status: "PLANNED",
    notes: null,
    client: null,
    territory: null,
    ownerId: null,
    owner: null,
    createdBy: "manager-1",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getUserScope.mockResolvedValue(TEAM_SCOPE);
  findUserIdsByRoleName.mockResolvedValue(["admin-1"]);
});

describe("createActivity", () => {
  it("creates the activity unassigned, attributed to the creator", async () => {
    createActivityRow.mockResolvedValue(activity());

    await createActivity(
      { type: "CAMPAIGN", date: "2026-10-10", clientId: "client-1" },
      "manager-1",
    );

    const data = createActivityRow.mock.calls[0]![0];
    expect(data.owner).toBeUndefined();
    expect(data.createdBy).toBe("manager-1");
  });
});

describe("assignActivity", () => {
  it("assigns a planned activity to someone in the manager's team", async () => {
    findActivityById.mockResolvedValue(activity());
    findUserById.mockResolvedValue({ id: "delegate-1", status: "ACTIVE" });
    assignActivityRow.mockResolvedValue(
      activity({ ownerId: "delegate-1", owner: { id: "delegate-1", name: "D" } }),
    );

    const result = await assignActivity({ id: "activity-1", ownerId: "delegate-1" }, MANAGER);

    expect(assignActivityRow).toHaveBeenCalledWith("activity-1", "delegate-1", "manager-1");
    expect(findUserById).toHaveBeenCalledWith("delegate-1", [...TEAM_SCOPE.userIds]);
    expect(result.owner?.id).toBe("delegate-1");
  });

  it("lets a manager assign an unassigned activity an admin created", async () => {
    findActivityById.mockResolvedValue(activity({ createdBy: "admin-1" }));
    findUserById.mockResolvedValue({ id: "delegate-1", status: "ACTIVE" });
    assignActivityRow.mockResolvedValue(activity({ ownerId: "delegate-1" }));

    await assignActivity({ id: "activity-1", ownerId: "delegate-1" }, MANAGER);

    expect(assignActivityRow).toHaveBeenCalledWith("activity-1", "delegate-1", "manager-1");
  });

  it("rejects an assignee outside the manager's team", async () => {
    findActivityById.mockResolvedValue(activity());
    findUserById.mockResolvedValue(null);

    await expect(
      assignActivity({ id: "activity-1", ownerId: "stranger" }, MANAGER),
    ).rejects.toBeInstanceOf(AssigneeOutsideScopeError);
    expect(assignActivityRow).not.toHaveBeenCalled();
  });

  it("rejects an inactive assignee", async () => {
    findActivityById.mockResolvedValue(activity());
    findUserById.mockResolvedValue({ id: "delegate-1", status: "INACTIVE" });

    await expect(
      assignActivity({ id: "activity-1", ownerId: "delegate-1" }, MANAGER),
    ).rejects.toBeInstanceOf(AssigneeOutsideScopeError);
  });

  it("rejects reassigning an activity that is no longer planned", async () => {
    findActivityById.mockResolvedValue(activity({ status: "DONE", ownerId: "delegate-1" }));

    await expect(
      assignActivity({ id: "activity-1", ownerId: "delegate-1" }, MANAGER),
    ).rejects.toBeInstanceOf(ActivityNotReassignableError);
  });

  it("rejects an activity outside the manager's team", async () => {
    findActivityById.mockResolvedValue(activity({ ownerId: "other-1", createdBy: "other-mgr" }));

    await expect(
      assignActivity({ id: "activity-1", ownerId: "delegate-1" }, MANAGER),
    ).rejects.toBeInstanceOf(ActivityNotAuthorizedError);
  });

  it("reports a missing activity", async () => {
    findActivityById.mockResolvedValue(null);

    await expect(
      assignActivity({ id: "missing", ownerId: "delegate-1" }, MANAGER),
    ).rejects.toBeInstanceOf(ActivityNotFoundError);
  });
});

describe("updateActivityStatus", () => {
  it("lets the assignee update their own activity", async () => {
    getUserScope.mockResolvedValue({ kind: "ids", userIds: ["delegate-1"] });
    findActivityById.mockResolvedValue(activity({ ownerId: "delegate-1" }));
    updateActivityStatusRow.mockResolvedValue(activity({ ownerId: "delegate-1", status: "DONE" }));

    await updateActivityStatus("activity-1", "DONE", DELEGATE, false);

    expect(updateActivityStatusRow).toHaveBeenCalledWith("activity-1", "DONE", "delegate-1");
  });

  it("blocks a delegate from changing someone else's activity by id", async () => {
    getUserScope.mockResolvedValue({ kind: "ids", userIds: ["delegate-1"] });
    findActivityById.mockResolvedValue(activity({ ownerId: "delegate-2" }));

    await expect(
      updateActivityStatus("activity-1", "DONE", DELEGATE, false),
    ).rejects.toBeInstanceOf(ActivityNotAuthorizedError);
    expect(updateActivityStatusRow).not.toHaveBeenCalled();
  });

  it("blocks a supervisor from changing a downstream delegate's activity", async () => {
    getUserScope.mockResolvedValue({ kind: "ids", userIds: ["supervisor-1", "delegate-1"] });
    findActivityById.mockResolvedValue(activity({ ownerId: "delegate-1" }));

    await expect(
      updateActivityStatus(
        "activity-1",
        "CANCELLED",
        { user: { id: "supervisor-1", roleName: "SUPERVISOR" } },
        false,
      ),
    ).rejects.toBeInstanceOf(ActivityNotAuthorizedError);
  });

  it("lets a manager cancel an unassigned activity they created", async () => {
    findActivityById.mockResolvedValue(activity());
    updateActivityStatusRow.mockResolvedValue(activity({ status: "CANCELLED" }));

    await updateActivityStatus("activity-1", "CANCELLED", MANAGER, true);

    expect(updateActivityStatusRow).toHaveBeenCalled();
  });

  it("blocks a manager from an activity outside their team", async () => {
    findActivityById.mockResolvedValue(activity({ ownerId: "other-1" }));

    await expect(
      updateActivityStatus("activity-1", "CANCELLED", MANAGER, true),
    ).rejects.toBeInstanceOf(ActivityNotAuthorizedError);
  });
});

const PAGE = { page: 2, pageSize: 5 };

describe("getActivitiesPageForViewer", () => {
  beforeEach(() => {
    listActivities.mockResolvedValue([]);
    countActivities.mockResolvedValue(0);
  });

  it("shows a manager their team's activities plus unassigned ones from their team or an admin", async () => {
    await getActivitiesPageForViewer(MANAGER, true, PAGE);

    expect(listActivities).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerIds: [...TEAM_SCOPE.userIds],
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
    expect(query.ownerIds).toEqual(["supervisor-1"]);
    expect(query.unassignedCreatorIds).toBeUndefined();
  });

  it("pages the query and counts it with the same filters", async () => {
    countActivities.mockResolvedValue(12);

    const result = await getActivitiesPageForViewer(MANAGER, true, PAGE, { unassignedOnly: true });

    expect(listActivities).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5, unassignedOnly: true }),
    );
    const countQuery = countActivities.mock.calls[0]![0];
    expect(countQuery.unassignedOnly).toBe(true);
    expect(countQuery.skip).toBeUndefined();
    expect(result).toMatchObject({ total: 12, page: 2, pageSize: 5 });
  });
});

describe("getActivitiesForMonth", () => {
  it("bounds the query to the calendar month, same visibility as the list", async () => {
    listActivities.mockResolvedValue([]);

    await getActivitiesForMonth(MANAGER, true, 2026, 9);

    expect(listActivities).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerIds: [...TEAM_SCOPE.userIds],
        from: new Date("2026-10-01T00:00:00.000Z"),
        to: new Date("2026-11-01T00:00:00.000Z"),
      }),
    );
  });

  it("rolls December over into January of the next year", async () => {
    listActivities.mockResolvedValue([]);

    await getActivitiesForMonth(DELEGATE, false, 2026, 11);

    const query = listActivities.mock.calls[0]![0];
    expect(query.from).toEqual(new Date("2026-12-01T00:00:00.000Z"));
    expect(query.to).toEqual(new Date("2027-01-01T00:00:00.000Z"));
    expect(query.ownerIds).toEqual(["delegate-1"]);
  });
});
