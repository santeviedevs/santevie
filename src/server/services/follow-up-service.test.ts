import { beforeEach, describe, expect, it, vi } from "vitest";

const createFollowUpRow = vi.fn();
const completeFollowUpRow = vi.fn();
const findPendingFollowUpsForOwner = vi.fn();
const findPendingFollowUps = vi.fn();
const findFollowUpById = vi.fn();
vi.mock("@/server/repositories/follow-up-repository", () => ({
  createFollowUpRow,
  completeFollowUpRow,
  findFollowUpById,
  findPendingFollowUpsForOwner,
  findPendingFollowUps,
}));

const getUserScope = vi.fn();
const scopeUserIds = vi.fn();
vi.mock("@/server/scope", () => ({ getUserScope, scopeUserIds }));

// The ownership rule itself is covered in activity-service.test.ts; here it
// is only a gate that either lets the call through or throws.
const getActivityForAction = vi.fn();
vi.mock("./activity-service", async () => {
  const actual = await vi.importActual<typeof import("./activity-service")>("./activity-service");
  return { ...actual, getActivityForAction };
});

const {
  ActivityUnassignedError,
  completeFollowUp,
  createFollowUp,
  getMyFollowUps,
  getTeamOverdueFollowUps,
} = await import("./follow-up-service");
const { ActivityNotAuthorizedError, ActivityNotFoundError } = await import("./activity-service");

const NOW = new Date("2026-06-15T12:00:00.000Z");

function followUp(id: string, dueDate: string, status: "PENDING" | "DONE", ownerId = "owner-1") {
  return {
    id,
    dueDate: new Date(dueDate),
    status,
    ownerId,
    activity: {
      id: "activity-1",
      type: "CAMPAIGN",
      date: new Date(dueDate),
      center: null,
      territory: null,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getMyFollowUps overdue calculation", () => {
  it("a follow-up due yesterday with PENDING status counts as overdue", async () => {
    findPendingFollowUpsForOwner.mockResolvedValue([
      followUp("f-1", "2026-06-14T00:00:00.000Z", "PENDING"),
    ]);

    const { pending, overdue } = await getMyFollowUps("owner-1", NOW);

    expect(pending).toHaveLength(1);
    expect(overdue).toHaveLength(1);
    expect(overdue[0]?.id).toBe("f-1");
  });

  it("a follow-up due tomorrow does not count as overdue, but is still pending", async () => {
    findPendingFollowUpsForOwner.mockResolvedValue([
      followUp("f-2", "2026-06-16T00:00:00.000Z", "PENDING"),
    ]);

    const { pending, overdue } = await getMyFollowUps("owner-1", NOW);

    expect(pending).toHaveLength(1);
    expect(overdue).toHaveLength(0);
  });

  it("a DONE follow-up never appears — the repository query itself already excludes it", async () => {
    // findPendingFollowUpsForOwner only ever returns PENDING rows (query
    // filters status: "PENDING"), so a completed follow-up due yesterday
    // simply isn't in what the mock returns here.
    findPendingFollowUpsForOwner.mockResolvedValue([]);

    const { pending, overdue } = await getMyFollowUps("owner-1", NOW);

    expect(pending).toHaveLength(0);
    expect(overdue).toHaveLength(0);
  });
});

describe("getTeamOverdueFollowUps scope enforcement", () => {
  it("scopes to the viewer's downstream team, not every follow-up in the system", async () => {
    getUserScope.mockResolvedValue({ kind: "ids", userIds: ["supervisor-1", "report-1"] });
    scopeUserIds.mockReturnValue(["supervisor-1", "report-1"]);
    findPendingFollowUps.mockResolvedValue([
      followUp("f-1", "2026-06-14T00:00:00.000Z", "PENDING", "report-1"),
    ]);

    await getTeamOverdueFollowUps({ user: { id: "supervisor-1", roleName: "SUPERVISOR" } }, NOW);

    expect(findPendingFollowUps).toHaveBeenCalledWith(["supervisor-1", "report-1"]);
  });

  it("passes undefined through for an unrestricted scope (ADMIN), never a manufactured list", async () => {
    getUserScope.mockResolvedValue({ kind: "all" });
    scopeUserIds.mockReturnValue(undefined);
    findPendingFollowUps.mockResolvedValue([]);

    await getTeamOverdueFollowUps({ user: { id: "admin-1", roleName: "ADMIN" } }, NOW);

    expect(findPendingFollowUps).toHaveBeenCalledWith(undefined);
  });
});

describe("createFollowUp", () => {
  const MANAGER = { user: { id: "manager-1", roleName: "MANAGER" } };

  it("gives the follow-up to the activity's assignee, not the creator", async () => {
    getActivityForAction.mockResolvedValue({ id: "activity-1", ownerId: "delegate-1" });
    createFollowUpRow.mockResolvedValue(followUp("f-1", "2026-06-20T00:00:00.000Z", "PENDING"));

    await createFollowUp({ activityId: "activity-1", dueDate: "2026-06-20" }, MANAGER, true);

    const data = createFollowUpRow.mock.calls[0]![0];
    expect(data.owner).toEqual({ connect: { id: "delegate-1" } });
    expect(data.createdBy).toBe("manager-1");
  });

  it("refuses a follow-up on an unassigned activity", async () => {
    getActivityForAction.mockResolvedValue({ id: "activity-1", ownerId: null });

    await expect(
      createFollowUp({ activityId: "activity-1", dueDate: "2026-06-20" }, MANAGER, true),
    ).rejects.toBeInstanceOf(ActivityUnassignedError);
    expect(createFollowUpRow).not.toHaveBeenCalled();
  });

  it("propagates the ownership check failing", async () => {
    getActivityForAction.mockRejectedValue(new ActivityNotAuthorizedError());

    await expect(
      createFollowUp({ activityId: "activity-1", dueDate: "2026-06-20" }, MANAGER, false),
    ).rejects.toBeInstanceOf(ActivityNotAuthorizedError);
  });
});

describe("completeFollowUp", () => {
  it("lets the follow-up's owner complete it", async () => {
    findFollowUpById.mockResolvedValue(
      followUp("f-1", "2026-06-14T00:00:00.000Z", "PENDING", "owner-1"),
    );
    completeFollowUpRow.mockResolvedValue(
      followUp("f-1", "2026-06-14T00:00:00.000Z", "DONE", "owner-1"),
    );

    await completeFollowUp("f-1", "owner-1");

    expect(completeFollowUpRow).toHaveBeenCalledWith("f-1", "owner-1");
  });

  it("blocks anyone else completing it by id", async () => {
    findFollowUpById.mockResolvedValue(
      followUp("f-1", "2026-06-14T00:00:00.000Z", "PENDING", "owner-1"),
    );

    await expect(completeFollowUp("f-1", "someone-else")).rejects.toBeInstanceOf(
      ActivityNotAuthorizedError,
    );
    expect(completeFollowUpRow).not.toHaveBeenCalled();
  });

  it("reports a missing follow-up", async () => {
    findFollowUpById.mockResolvedValue(null);

    await expect(completeFollowUp("missing", "owner-1")).rejects.toBeInstanceOf(
      ActivityNotFoundError,
    );
  });
});
