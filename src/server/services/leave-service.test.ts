import { beforeEach, describe, expect, it, vi } from "vitest";

const countFilteredLeaves = vi.fn();
const createLeaveRow = vi.fn();
const findLeaveById = vi.fn();
const findLeaves = vi.fn();
const findOverlappingLeave = vi.fn();
const updateLeaveRow = vi.fn();
vi.mock("@/server/repositories/leave-repository", () => ({
  countFilteredLeaves,
  createLeaveRow,
  findLeaveById,
  findLeaves,
  findOverlappingLeave,
  updateLeaveRow,
}));

const findUserById = vi.fn();
vi.mock("@/server/repositories/user-repository", () => ({ findUserById }));

const getUserScope = vi.fn();
const isWithinScope = vi.fn();
vi.mock("@/server/scope", () => ({ getUserScope, isWithinScope }));

const {
  applyLeave,
  decideLeave,
  listTeamLeaves,
  InactiveRequesterError,
  OverlappingLeaveError,
  LeaveNotFoundError,
  InvalidLeaveTransitionError,
  NotAuthorizedApproverError,
} = await import("./leave-service");

const baseLeaveRow = (overrides: Record<string, unknown> = {}) => ({
  id: "leave-1",
  startDate: new Date("2026-10-05"),
  endDate: new Date("2026-10-07"),
  reason: "Family event",
  status: "PENDING",
  decidedBy: null,
  decidedAt: null,
  decisionRemark: null,
  userId: "delegate-1",
  user: {
    id: "delegate-1",
    name: "Delegate One",
    employeeCode: "EMP-D1",
    managerId: "supervisor-1",
  },
  leaveType: { id: "leave-type-1", name: "Annual Leave" },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  findUserById.mockResolvedValue({ id: "delegate-1", status: "ACTIVE" });
  findOverlappingLeave.mockResolvedValue(null);
  createLeaveRow.mockResolvedValue(baseLeaveRow());
});

describe("applyLeave", () => {
  const input = {
    leaveTypeId: "leave-type-1",
    startDate: "2026-10-05",
    endDate: "2026-10-07",
    reason: "Family event",
  };

  it("applies leave for an active requester", async () => {
    const result = await applyLeave(input, "delegate-1");
    expect(result.status).toBe("PENDING");
    expect(createLeaveRow).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "PENDING",
        createdBy: "delegate-1",
        updatedBy: "delegate-1",
      }),
    );
  });

  it("rejects an inactive requester", async () => {
    findUserById.mockResolvedValue({ id: "delegate-1", status: "INACTIVE" });
    await expect(applyLeave(input, "delegate-1")).rejects.toThrow(InactiveRequesterError);
    expect(createLeaveRow).not.toHaveBeenCalled();
  });

  it("rejects when a Pending or Approved leave already overlaps the range", async () => {
    findOverlappingLeave.mockResolvedValue({ id: "existing-leave" });
    await expect(applyLeave(input, "delegate-1")).rejects.toThrow(OverlappingLeaveError);
    expect(findOverlappingLeave).toHaveBeenCalledWith(
      "delegate-1",
      new Date(input.startDate),
      new Date(input.endDate),
      ["PENDING", "APPROVED"],
    );
    expect(createLeaveRow).not.toHaveBeenCalled();
  });
});

describe("decideLeave", () => {
  const approver = { id: "supervisor-1", roleName: "SUPERVISOR" };

  beforeEach(() => {
    findLeaveById.mockResolvedValue(baseLeaveRow());
    getUserScope.mockResolvedValue({ kind: "ids", userIds: ["supervisor-1", "delegate-1"] });
    isWithinScope.mockReturnValue(true);
    updateLeaveRow.mockResolvedValue(baseLeaveRow({ status: "APPROVED" }));
  });

  it("throws when the leave request does not exist", async () => {
    findLeaveById.mockResolvedValue(null);
    await expect(decideLeave("missing", "APPROVED", undefined, approver)).rejects.toThrow(
      LeaveNotFoundError,
    );
  });

  it("throws when the request is already decided", async () => {
    findLeaveById.mockResolvedValue(baseLeaveRow({ status: "APPROVED" }));
    await expect(decideLeave("leave-1", "REJECTED", undefined, approver)).rejects.toThrow(
      InvalidLeaveTransitionError,
    );
    expect(updateLeaveRow).not.toHaveBeenCalled();
  });

  it("allows the requester's direct manager (in scope) to approve", async () => {
    const result = await decideLeave("leave-1", "APPROVED", undefined, approver);
    expect(result.status).toBe("APPROVED");
    expect(getUserScope).toHaveBeenCalledWith({ user: approver });
    expect(isWithinScope).toHaveBeenCalledWith(
      { kind: "ids", userIds: ["supervisor-1", "delegate-1"] },
      "delegate-1",
    );
  });

  it("blocks an unrelated supervisor whose downstream doesn't include the requester", async () => {
    isWithinScope.mockReturnValue(false);
    await expect(decideLeave("leave-1", "APPROVED", undefined, approver)).rejects.toThrow(
      NotAuthorizedApproverError,
    );
    expect(updateLeaveRow).not.toHaveBeenCalled();
  });

  it("lets a Manager approve a downstream delegate directly (skip-level), via an 'all' scope", async () => {
    const manager = { id: "manager-1", roleName: "MANAGER" };
    getUserScope.mockResolvedValue({ kind: "all" });
    isWithinScope.mockReturnValue(true);
    await decideLeave("leave-1", "APPROVED", undefined, manager);
    expect(getUserScope).toHaveBeenCalledWith({ user: manager });
  });

  it("lets Admin decide their own request without consulting scope (no superior exists to check)", async () => {
    findLeaveById.mockResolvedValue(
      baseLeaveRow({
        userId: "admin-1",
        user: { id: "admin-1", name: "Admin", employeeCode: "EMP-ADMIN", managerId: null },
      }),
    );
    const admin = { id: "admin-1", roleName: "ADMIN" };
    const result = await decideLeave("leave-1", "APPROVED", undefined, admin);
    expect(result).toBeDefined();
    expect(getUserScope).not.toHaveBeenCalled();
  });

  it("blocks a Supervisor from self-approving their own request, even though scope includes self", async () => {
    findLeaveById.mockResolvedValue(
      baseLeaveRow({
        userId: "supervisor-1",
        user: {
          id: "supervisor-1",
          name: "Supervisor One",
          employeeCode: "EMP-S1",
          managerId: "manager-1",
        },
      }),
    );
    // Reflects getUserScope's real SUPERVISOR behavior: [self, ...downstream].
    getUserScope.mockResolvedValue({ kind: "ids", userIds: ["supervisor-1", "delegate-1"] });
    isWithinScope.mockReturnValue(true);
    await expect(decideLeave("leave-1", "APPROVED", undefined, approver)).rejects.toThrow(
      NotAuthorizedApproverError,
    );
    expect(updateLeaveRow).not.toHaveBeenCalled();
  });

  it("blocks a Manager from self-approving their own request, even though scope is 'all'", async () => {
    findLeaveById.mockResolvedValue(
      baseLeaveRow({
        userId: "manager-1",
        user: {
          id: "manager-1",
          name: "Manager One",
          employeeCode: "EMP-M1",
          managerId: "admin-1",
        },
      }),
    );
    const manager = { id: "manager-1", roleName: "MANAGER" };
    await expect(decideLeave("leave-1", "APPROVED", undefined, manager)).rejects.toThrow(
      NotAuthorizedApproverError,
    );
    expect(getUserScope).not.toHaveBeenCalled();
    expect(updateLeaveRow).not.toHaveBeenCalled();
  });

  it("records the optional decision remark separately from the requester's own reason", async () => {
    await decideLeave("leave-1", "REJECTED", "Team is short-staffed that week", approver);
    expect(updateLeaveRow).toHaveBeenCalledWith(
      "leave-1",
      expect.objectContaining({
        status: "REJECTED",
        decisionRemark: "Team is short-staffed that week",
        decidedBy: "supervisor-1",
      }),
    );
  });
});

describe("listTeamLeaves", () => {
  const downstream = ["delegate-1", "delegate-2"];
  const filters = {
    page: 1,
    pageSize: 5,
  } as Parameters<typeof listTeamLeaves>[1];

  beforeEach(() => {
    findLeaves.mockResolvedValue([]);
    countFilteredLeaves.mockResolvedValue(0);
  });

  it("passes the full downstream scope through when no employeeId filter is set", async () => {
    await listTeamLeaves(downstream, filters);
    expect(findLeaves).toHaveBeenCalledWith(filters, downstream);
  });

  it("narrows to just that employee when employeeId is within the downstream scope", async () => {
    await listTeamLeaves(downstream, { ...filters, employeeId: "delegate-2" });
    expect(findLeaves).toHaveBeenCalledWith(expect.objectContaining({ employeeId: "delegate-2" }), [
      "delegate-2",
    ]);
  });

  it("resolves to an empty scope (not the full team) when employeeId is outside the downstream scope", async () => {
    await listTeamLeaves(downstream, { ...filters, employeeId: "someone-elses-report" });
    expect(findLeaves).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: "someone-elses-report" }),
      [],
    );
    expect(countFilteredLeaves).toHaveBeenCalledWith(expect.anything(), []);
  });
});
