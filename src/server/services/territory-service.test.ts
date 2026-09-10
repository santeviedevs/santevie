import { beforeEach, describe, expect, it, vi } from "vitest";

const createTerritory = vi.fn();
const updateTerritory = vi.fn();
const setTerritoryStatus = vi.fn();
const countActiveAssignments = vi.fn();

vi.mock("@/server/repositories/territory-repository", () => ({
  createTerritory,
  updateTerritory,
  setTerritoryStatus,
  countActiveAssignments,
  findTerritories: vi.fn(),
  findTerritoryById: vi.fn(),
}));

const {
  createTerritory: createTerritoryService,
  updateTerritory: updateTerritoryService,
  activateTerritory: activateTerritoryService,
  deactivateTerritory: deactivateTerritoryService,
  DuplicateTerritoryCodeError,
  TerritoryInUseError,
} = await import("./territory-service");

const baseTerritoryRow = (overrides: Record<string, unknown> = {}) => ({
  id: "territory-1",
  code: "NORTH",
  name: "North",
  status: "ACTIVE",
  ...overrides,
});

const baseInput = { code: "NORTH", name: "North" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createTerritory", () => {
  it("creates a territory", async () => {
    createTerritory.mockResolvedValueOnce(baseTerritoryRow());

    await expect(createTerritoryService(baseInput, "actor-1")).resolves.toMatchObject({
      code: "NORTH",
    });
  });

  it("maps a duplicate code constraint to DuplicateTerritoryCodeError", async () => {
    createTerritory.mockRejectedValueOnce({ code: "P2002", meta: { target: ["code"] } });

    await expect(createTerritoryService(baseInput, "actor-1")).rejects.toThrow(
      DuplicateTerritoryCodeError,
    );
  });

  it("rethrows an unrelated error unchanged", async () => {
    createTerritory.mockRejectedValueOnce(new Error("connection lost"));

    await expect(createTerritoryService(baseInput, "actor-1")).rejects.toThrow("connection lost");
  });
});

describe("updateTerritory", () => {
  it("maps a duplicate code constraint to DuplicateTerritoryCodeError", async () => {
    updateTerritory.mockRejectedValueOnce({ code: "P2002", meta: { target: ["code"] } });

    await expect(
      updateTerritoryService({ ...baseInput, id: "territory-1" }, "actor-1"),
    ).rejects.toThrow(DuplicateTerritoryCodeError);
  });
});

describe("activateTerritory", () => {
  it("sets the status to ACTIVE without checking assignments", async () => {
    setTerritoryStatus.mockResolvedValueOnce(baseTerritoryRow({ status: "ACTIVE" }));

    await expect(activateTerritoryService("territory-1", "actor-1")).resolves.toMatchObject({
      status: "ACTIVE",
    });
    expect(setTerritoryStatus).toHaveBeenCalledWith("territory-1", "ACTIVE", "actor-1");
    expect(countActiveAssignments).not.toHaveBeenCalled();
  });
});

// The deactivation guard required by S2-01: a territory with active users or
// clients assigned must not be deactivated.
describe("deactivateTerritory", () => {
  it("deactivates a territory with no active assignments", async () => {
    countActiveAssignments.mockResolvedValueOnce({ activeUsers: 0, activeClients: 0 });
    setTerritoryStatus.mockResolvedValueOnce(baseTerritoryRow({ status: "INACTIVE" }));

    await expect(deactivateTerritoryService("territory-1", "actor-1")).resolves.toMatchObject({
      status: "INACTIVE",
    });
  });

  it("rejects deactivation while active users are assigned", async () => {
    countActiveAssignments.mockResolvedValueOnce({ activeUsers: 2, activeClients: 0 });

    await expect(deactivateTerritoryService("territory-1", "actor-1")).rejects.toThrow(
      TerritoryInUseError,
    );
    expect(setTerritoryStatus).not.toHaveBeenCalled();
  });

  it("rejects deactivation while active clients are assigned", async () => {
    countActiveAssignments.mockResolvedValueOnce({ activeUsers: 0, activeClients: 5 });

    await expect(deactivateTerritoryService("territory-1", "actor-1")).rejects.toThrow(
      TerritoryInUseError,
    );
    expect(setTerritoryStatus).not.toHaveBeenCalled();
  });

  it("includes both counts in the error message when both are present", async () => {
    countActiveAssignments.mockResolvedValueOnce({ activeUsers: 1, activeClients: 3 });

    await expect(deactivateTerritoryService("territory-1", "actor-1")).rejects.toThrow(
      "1 active user and 3 active clients still assigned to this territory.",
    );
  });
});
