import { beforeEach, describe, expect, it, vi } from "vitest";

const createAssignment = vi.fn();
const deleteAssignment = vi.fn();
const findAssignmentById = vi.fn();
const listAssignmentsForUser = vi.fn();

vi.mock("@/server/repositories/territory-assignment-repository", () => ({
  createAssignment,
  deleteAssignment,
  findAssignmentById,
  listAssignmentsForUser,
}));

const findTerritoryById = vi.fn();

vi.mock("@/server/repositories/territory-repository", () => ({
  findTerritoryById,
}));

const {
  assignTerritory,
  removeTerritoryAssignment,
  listTerritoryAssignments,
  TerritoryNotFoundError,
  InactiveTerritoryError,
  DuplicateAssignmentError,
  AssignmentNotFoundError,
} = await import("./territory-assignment-service");

beforeEach(() => {
  vi.clearAllMocks();
  findTerritoryById.mockResolvedValue({ id: "territory-1", status: "ACTIVE" });
});

describe("assignTerritory", () => {
  it("assigns the given territory to the user", async () => {
    createAssignment.mockResolvedValueOnce({
      id: "assignment-1",
      territory: {
        id: "territory-1",
        code: "TER-00001",
        province: { id: "p1", name: "Équateur" },
        ville: null,
        commune: null,
        quartier: { id: "q1", name: "Bongondo" },
      },
    });

    const result = await assignTerritory(
      { userId: "user-1", territoryId: "territory-1" },
      "actor-1",
    );

    expect(result).toMatchObject({
      id: "assignment-1",
      code: "TER-00001",
      label: "Équateur › Bongondo",
    });
    expect(createAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { connect: { id: "user-1" } },
        territory: { connect: { id: "territory-1" } },
      }),
    );
  });

  it("rejects assigning an inactive territory", async () => {
    findTerritoryById.mockResolvedValueOnce({ id: "territory-1", status: "INACTIVE" });

    await expect(
      assignTerritory({ userId: "user-1", territoryId: "territory-1" }, "actor-1"),
    ).rejects.toThrow(InactiveTerritoryError);
    expect(createAssignment).not.toHaveBeenCalled();
  });

  it("rejects when the target territory no longer exists", async () => {
    findTerritoryById.mockResolvedValueOnce(null);

    await expect(
      assignTerritory({ userId: "user-1", territoryId: "missing" }, "actor-1"),
    ).rejects.toThrow(TerritoryNotFoundError);
  });

  it("maps a unique-constraint violation to DuplicateAssignmentError", async () => {
    createAssignment.mockRejectedValueOnce({ code: "P2002" });

    await expect(
      assignTerritory({ userId: "user-1", territoryId: "territory-1" }, "actor-1"),
    ).rejects.toThrow(DuplicateAssignmentError);
  });

  it("rethrows an unrelated error unchanged", async () => {
    createAssignment.mockRejectedValueOnce(new Error("connection lost"));

    await expect(
      assignTerritory({ userId: "user-1", territoryId: "territory-1" }, "actor-1"),
    ).rejects.toThrow("connection lost");
  });
});

describe("removeTerritoryAssignment", () => {
  it("deletes an existing assignment", async () => {
    findAssignmentById.mockResolvedValueOnce({ id: "assignment-1" });

    await removeTerritoryAssignment("assignment-1");

    expect(deleteAssignment).toHaveBeenCalledWith("assignment-1");
  });

  it("rejects removing an assignment that no longer exists", async () => {
    findAssignmentById.mockResolvedValueOnce(null);

    await expect(removeTerritoryAssignment("gone")).rejects.toThrow(AssignmentNotFoundError);
    expect(deleteAssignment).not.toHaveBeenCalled();
  });
});

describe("listTerritoryAssignments", () => {
  it("maps each row to its territory code and path label", async () => {
    listAssignmentsForUser.mockResolvedValueOnce([
      {
        id: "a1",
        territory: {
          id: "t1",
          code: "TER-00001",
          province: { id: "p1", name: "Équateur" },
          ville: null,
          commune: null,
          quartier: null,
        },
      },
      {
        id: "a2",
        territory: {
          id: "t2",
          code: "TER-00002",
          province: { id: "p1", name: "Équateur" },
          ville: { id: "v1", name: "Mbandaka" },
          commune: { id: "c1", name: "Wangata" },
          quartier: { id: "q1", name: "Bongondo" },
        },
      },
    ]);

    const result = await listTerritoryAssignments("user-1");

    expect(result).toEqual([
      { id: "a1", territoryId: "t1", code: "TER-00001", label: "Équateur" },
      {
        id: "a2",
        territoryId: "t2",
        code: "TER-00002",
        label: "Équateur › Mbandaka › Wangata › Bongondo",
      },
    ]);
  });
});
