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

const findTerritoryEntryById = vi.fn();

vi.mock("@/server/repositories/territory-repository", () => ({
  findTerritoryEntryById,
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
  findTerritoryEntryById.mockResolvedValue({
    level: "quartier",
    row: { id: "quartier-1", status: "ACTIVE" },
  });
});

describe("assignTerritory", () => {
  it("assigns the deepest level given, ignoring the ancestor ids carried alongside it", async () => {
    createAssignment.mockResolvedValueOnce({
      id: "assignment-1",
      province: null,
      ville: null,
      commune: null,
      quartier: { id: "quartier-1", name: "Bongondo" },
    });

    const result = await assignTerritory(
      {
        userId: "user-1",
        provinceId: "province-1",
        villeId: "ville-1",
        communeId: "commune-1",
        quartierId: "quartier-1",
      },
      "actor-1",
    );

    expect(result).toMatchObject({ level: "quartier", name: "Bongondo" });
    expect(createAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { connect: { id: "user-1" } },
        quartier: { connect: { id: "quartier-1" } },
      }),
    );
    // Only the deepest level is ever persisted — see the model comment in
    // schema.prisma for why storing every ancestor would break the
    // per-level unique constraints.
    expect(createAssignment).not.toHaveBeenCalledWith(
      expect.objectContaining({ province: expect.anything() }),
    );
  });

  it("rejects assigning an inactive territory", async () => {
    findTerritoryEntryById.mockResolvedValueOnce({
      level: "quartier",
      row: { id: "quartier-1", status: "INACTIVE" },
    });

    await expect(
      assignTerritory({ userId: "user-1", quartierId: "quartier-1" }, "actor-1"),
    ).rejects.toThrow(InactiveTerritoryError);
    expect(createAssignment).not.toHaveBeenCalled();
  });

  it("rejects when the target territory no longer exists", async () => {
    findTerritoryEntryById.mockResolvedValueOnce(null);

    await expect(
      assignTerritory({ userId: "user-1", quartierId: "missing" }, "actor-1"),
    ).rejects.toThrow(TerritoryNotFoundError);
  });

  it("maps a unique-constraint violation to DuplicateAssignmentError", async () => {
    createAssignment.mockRejectedValueOnce({ code: "P2002" });

    await expect(
      assignTerritory({ userId: "user-1", quartierId: "quartier-1" }, "actor-1"),
    ).rejects.toThrow(DuplicateAssignmentError);
  });

  it("rethrows an unrelated error unchanged", async () => {
    createAssignment.mockRejectedValueOnce(new Error("connection lost"));

    await expect(
      assignTerritory({ userId: "user-1", quartierId: "quartier-1" }, "actor-1"),
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
  it("maps each row to its level and name", async () => {
    listAssignmentsForUser.mockResolvedValueOnce([
      {
        id: "a1",
        province: { id: "p1", name: "Équateur" },
        ville: null,
        commune: null,
        quartier: null,
      },
      {
        id: "a2",
        province: null,
        ville: null,
        commune: null,
        quartier: { id: "q1", name: "Bongondo" },
      },
    ]);

    const result = await listTerritoryAssignments("user-1");

    expect(result).toEqual([
      { id: "a1", level: "province", name: "Équateur" },
      { id: "a2", level: "quartier", name: "Bongondo" },
    ]);
  });
});
