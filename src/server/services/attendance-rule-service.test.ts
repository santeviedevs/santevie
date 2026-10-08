import { beforeEach, describe, expect, it, vi } from "vitest";

const createAttendanceRuleRow = vi.fn();
const findCandidateRules = vi.fn();
const listAttendanceRules = vi.fn();
vi.mock("@/server/repositories/attendance-rule-repository", () => ({
  createAttendanceRuleRow,
  findCandidateRules,
  listAttendanceRules,
}));

const listAssignmentsForUser = vi.fn();
vi.mock("@/server/repositories/territory-assignment-repository", () => ({
  listAssignmentsForUser,
}));

const getDownstreamUserIds = vi.fn();
const getUpstreamManagerIds = vi.fn();
vi.mock("@/server/scope", () => ({ getDownstreamUserIds, getUpstreamManagerIds }));

const { resolveAttendanceThresholds, createAttendanceRule, AttendanceRuleScopeError } =
  await import("./attendance-rule-service");

function rule(overrides: Record<string, unknown> = {}) {
  return {
    id: "rule-1",
    expectedStartMinutes: 540,
    lateGraceMinutes: 15,
    minimumWorkedMinutes: 240,
    territoryId: null,
    ownerId: null,
    targetUserId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    createdBy: "admin-1",
    updatedBy: "admin-1",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  listAssignmentsForUser.mockResolvedValue([{ territoryId: "territory-1" }]);
  getUpstreamManagerIds.mockResolvedValue(["supervisor-1", "manager-1"]);
});

describe("resolveAttendanceThresholds", () => {
  it("falls back to the global default when no rule exists at all", async () => {
    findCandidateRules.mockResolvedValue([]);

    const result = await resolveAttendanceThresholds("delegate-1", new Date("2026-06-01"));

    expect(result.source).toBe("global");
  });

  it("applies a territory rule when it is the only candidate", async () => {
    const territoryRule = rule({ id: "territory-rule", territoryId: "territory-1" });
    findCandidateRules.mockResolvedValue([territoryRule]);

    const result = await resolveAttendanceThresholds("delegate-1", new Date("2026-06-01"));

    expect(result.source).toBe("territory");
  });

  it("a newer team rule overrides an older territory rule", async () => {
    const teamRule = rule({
      id: "team-rule",
      ownerId: "manager-1",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
    });
    const territoryRule = rule({
      id: "territory-rule",
      territoryId: "territory-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    // Repository returns newest-first, same as the real query's orderBy.
    findCandidateRules.mockResolvedValue([teamRule, territoryRule]);

    const result = await resolveAttendanceThresholds("delegate-1", new Date("2026-06-01"));

    expect(result.source).toBe("team");
  });

  it("an individual override for one delegate does not leak into another delegate's resolution", async () => {
    const individualRule = rule({
      id: "individual-rule",
      targetUserId: "delegate-1",
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
    });
    const territoryRule = rule({
      id: "territory-rule",
      territoryId: "territory-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    // delegate-1's candidate pool includes the individual override (the
    // repository call is scoped by targetUserId, which the service passes
    // as delegate-1 here).
    findCandidateRules.mockResolvedValueOnce([individualRule, territoryRule]);
    const delegateOneResult = await resolveAttendanceThresholds(
      "delegate-1",
      new Date("2026-06-01"),
    );
    expect(delegateOneResult.source).toBe("individual");

    // delegate-2's candidate pool never contains delegate-1's individual
    // override — simulated here by the repository call for delegate-2
    // simply not returning it (findCandidateRules is scoped server-side by
    // targetUserId = delegate-2, so it structurally can't come back).
    findCandidateRules.mockResolvedValueOnce([territoryRule]);
    const delegateTwoResult = await resolveAttendanceThresholds(
      "delegate-2",
      new Date("2026-06-01"),
    );
    expect(delegateTwoResult.source).toBe("territory");
  });

  it("resolving a past business date ignores a rule created after that date (historical stability)", async () => {
    const oldRule = rule({
      id: "old-rule",
      territoryId: "territory-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const newerRule = rule({
      id: "newer-rule",
      territoryId: "territory-1",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    // Repository returns newest-first; the service must filter by
    // createdAt <= businessDate, not just take candidates[0].
    findCandidateRules.mockResolvedValue([newerRule, oldRule]);

    const pastResult = await resolveAttendanceThresholds("delegate-1", new Date("2026-06-01"));
    expect(pastResult.expectedStartMinutes).toBe(oldRule.expectedStartMinutes);

    const futureResult = await resolveAttendanceThresholds("delegate-1", new Date("2026-09-01"));
    expect(futureResult.expectedStartMinutes).toBe(newerRule.expectedStartMinutes);
  });
});

describe("createAttendanceRule authorization", () => {
  // Team scope has no target field at all — it's always "my own downstream
  // team," resolved from the actor, never accepted from the client (fixed
  // after a UI review surfaced a picker that let the actor pick someone
  // else's id, which the original design never intended).
  const baseInput = {
    scope: "team" as const,
    expectedStartMinutes: 540,
    lateGraceMinutes: 15,
    minimumWorkedMinutes: 240,
  };

  it("needs no authorization check for team scope — any permission holder may set their own team rule", async () => {
    createAttendanceRuleRow.mockResolvedValue(rule());

    await expect(
      createAttendanceRule(baseInput, "supervisor-1", "SUPERVISOR"),
    ).resolves.toBeDefined();
    expect(getDownstreamUserIds).not.toHaveBeenCalled();
  });

  it("always sets the rule's owner to the actor, ignoring anything else in the input", async () => {
    createAttendanceRuleRow.mockResolvedValue(rule());

    await createAttendanceRule(baseInput, "supervisor-1", "SUPERVISOR");

    expect(createAttendanceRuleRow).toHaveBeenCalledWith(
      expect.objectContaining({ owner: { connect: { id: "supervisor-1" } } }),
    );
  });

  it("allows a non-admin to set a territory rule unrestricted (matches working-days:manage precedent)", async () => {
    createAttendanceRuleRow.mockResolvedValue(rule());

    await expect(
      createAttendanceRule(
        {
          expectedStartMinutes: 540,
          lateGraceMinutes: 15,
          minimumWorkedMinutes: 240,
          scope: "territory" as const,
          territoryId: "territory-1",
        },
        "manager-1",
        "MANAGER",
      ),
    ).resolves.toBeDefined();
  });

  const individualInput = {
    scope: "individual" as const,
    targetUserId: "some-other-user",
    expectedStartMinutes: 540,
    lateGraceMinutes: 15,
    minimumWorkedMinutes: 240,
  };

  it("allows ADMIN to set an individual override for anyone", async () => {
    createAttendanceRuleRow.mockResolvedValue(rule());

    await expect(createAttendanceRule(individualInput, "admin-1", "ADMIN")).resolves.toBeDefined();
  });

  it("allows a SUPERVISOR to set an individual override for themselves", async () => {
    createAttendanceRuleRow.mockResolvedValue(rule());

    await expect(
      createAttendanceRule(
        { ...individualInput, targetUserId: "supervisor-1" },
        "supervisor-1",
        "SUPERVISOR",
      ),
    ).resolves.toBeDefined();
    expect(getDownstreamUserIds).not.toHaveBeenCalled();
  });

  it("allows a SUPERVISOR to set an individual override for someone in their downstream chain", async () => {
    getDownstreamUserIds.mockResolvedValue(["some-other-user"]);
    createAttendanceRuleRow.mockResolvedValue(rule());

    await expect(
      createAttendanceRule(individualInput, "supervisor-1", "SUPERVISOR"),
    ).resolves.toBeDefined();
  });

  it("rejects a SUPERVISOR setting an individual override for someone outside their downstream chain", async () => {
    getDownstreamUserIds.mockResolvedValue(["someone-else"]);

    await expect(
      createAttendanceRule(individualInput, "supervisor-1", "SUPERVISOR"),
    ).rejects.toThrow(AttendanceRuleScopeError);
    expect(createAttendanceRuleRow).not.toHaveBeenCalled();
  });
});
