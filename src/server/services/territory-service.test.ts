import { beforeEach, describe, expect, it, vi } from "vitest";

const createCommune = vi.fn();
const createProvince = vi.fn();
const createQuartier = vi.fn();
const createTerritoryRow = vi.fn();
const createVille = vi.fn();
const findCommuneById = vi.fn();
const findProvinceById = vi.fn();
const findQuartierById = vi.fn();
const findTerritories = vi.fn();
const findTerritoryById = vi.fn();
const findTerritoryByPathKey = vi.fn();
const findVilleById = vi.fn();
const listActiveTerritories = vi.fn();
const updateTerritoryRow = vi.fn();
const countTerritories = vi.fn();
const countTerritoryDependents = vi.fn();

vi.mock("@/server/repositories/territory-repository", () => ({
  createCommune,
  createProvince,
  createQuartier,
  createTerritoryRow,
  createVille,
  findCommuneById,
  findProvinceById,
  findQuartierById,
  findTerritories,
  findTerritoryById,
  findTerritoryByPathKey,
  findVilleById,
  listActiveTerritories,
  updateTerritoryRow,
  countTerritories,
  countTerritoryDependents,
}));

const {
  createTerritory,
  updateTerritoryEntry,
  findOrCreateTerritory,
  listTerritories,
  getTerritory,
  listActiveTerritoryOptions,
  DuplicateTerritoryNameError,
  DuplicateTerritoryPathError,
  InvalidTerritoryHierarchyError,
  InactiveParentError,
  TerritoryInUseError,
} = await import("./territory-service");

const existing = (id: string) => ({ mode: "existing" as const, id });
const fresh = (name: string) => ({ mode: "new" as const, name });

const baseTerritoryRow = (overrides: Record<string, unknown> = {}) => ({
  id: "territory-1",
  code: "TER-00001",
  status: "ACTIVE",
  province: { id: "province-1", name: "Équateur" },
  ville: null,
  commune: null,
  quartier: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  findProvinceById.mockResolvedValue({ id: "province-1", status: "ACTIVE" });
  findVilleById.mockResolvedValue({ id: "ville-1", provinceId: "province-1", status: "ACTIVE" });
  findCommuneById.mockResolvedValue({ id: "commune-1", villeId: "ville-1", status: "ACTIVE" });
  findQuartierById.mockResolvedValue({
    id: "quartier-1",
    communeId: "commune-1",
    status: "ACTIVE",
  });
  countTerritories.mockResolvedValue(0);
  countTerritoryDependents.mockResolvedValue({
    activeClients: 0,
    activeUsers: 0,
    activeAssignments: 0,
  });
});

describe("createTerritory", () => {
  it("creates a Province-only territory when nothing else is given", async () => {
    createProvince.mockResolvedValueOnce({ id: "province-1" });
    findTerritoryByPathKey.mockResolvedValueOnce(null);
    createTerritoryRow.mockResolvedValueOnce(baseTerritoryRow());

    const result = await createTerritory({ province: fresh("Équateur") }, "actor-1");

    expect(result).toMatchObject({ code: "TER-00001", province: { name: "Équateur" } });
    expect(createTerritoryRow).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "TER-00001",
        province: { connect: { id: "province-1" } },
        ville: undefined,
        commune: undefined,
        quartier: undefined,
        pathKey: "province-1:-:-:-",
      }),
    );
  });

  it("creates the full path when every level is new", async () => {
    createProvince.mockResolvedValueOnce({ id: "new-province" });
    createVille.mockResolvedValueOnce({ id: "new-ville" });
    createCommune.mockResolvedValueOnce({ id: "new-commune" });
    createQuartier.mockResolvedValueOnce({ id: "new-quartier" });
    findTerritoryByPathKey.mockResolvedValueOnce(null);
    createTerritoryRow.mockResolvedValueOnce(baseTerritoryRow());

    await createTerritory(
      {
        province: fresh("Équateur"),
        ville: fresh("Mbandaka"),
        commune: fresh("Wangata"),
        quartier: fresh("Bongondo"),
      },
      "actor-1",
    );

    expect(createVille).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Mbandaka", province: { connect: { id: "new-province" } } }),
    );
    expect(createCommune).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Wangata", ville: { connect: { id: "new-ville" } } }),
    );
    expect(createQuartier).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Bongondo", commune: { connect: { id: "new-commune" } } }),
    );
    expect(createTerritoryRow).toHaveBeenCalledWith(
      expect.objectContaining({
        pathKey: "new-province:new-ville:new-commune:new-quartier",
      }),
    );
  });

  it("matches an existing Territory for the same path instead of creating a duplicate", async () => {
    findTerritoryByPathKey.mockResolvedValueOnce(baseTerritoryRow({ code: "TER-00007" }));

    const result = await createTerritory({ province: existing("province-1") }, "actor-1");

    expect(result.code).toBe("TER-00007");
    expect(createTerritoryRow).not.toHaveBeenCalled();
  });

  it("rejects an existing ville that belongs to a different province", async () => {
    findVilleById.mockResolvedValueOnce({
      id: "ville-1",
      provinceId: "some-other-province",
      status: "ACTIVE",
    });

    await expect(
      createTerritory({ province: existing("province-1"), ville: existing("ville-1") }, "actor-1"),
    ).rejects.toThrow(InvalidTerritoryHierarchyError);
    expect(createTerritoryRow).not.toHaveBeenCalled();
  });

  it("rejects an existing ville under an inactive province", async () => {
    findProvinceById.mockResolvedValueOnce({ id: "province-1", status: "INACTIVE" });

    await expect(createTerritory({ province: existing("province-1") }, "actor-1")).rejects.toThrow(
      InactiveParentError,
    );
  });

  it("maps a duplicate name constraint on a new province to DuplicateTerritoryNameError", async () => {
    createProvince.mockRejectedValueOnce({ code: "P2002" });

    await expect(createTerritory({ province: fresh("Équateur") }, "actor-1")).rejects.toThrow(
      DuplicateTerritoryNameError,
    );
  });

  it("generates the next sequential code based on the current territory count", async () => {
    createProvince.mockResolvedValueOnce({ id: "province-1" });
    findTerritoryByPathKey.mockResolvedValueOnce(null);
    countTerritories.mockResolvedValueOnce(11);
    createTerritoryRow.mockResolvedValueOnce(baseTerritoryRow({ code: "TER-00012" }));

    await createTerritory({ province: fresh("Équateur") }, "actor-1");

    expect(createTerritoryRow).toHaveBeenCalledWith(expect.objectContaining({ code: "TER-00012" }));
  });

  it("retries with the next code on a code collision", async () => {
    createProvince.mockResolvedValueOnce({ id: "province-1" });
    findTerritoryByPathKey.mockResolvedValueOnce(null);
    countTerritories.mockResolvedValueOnce(0);
    createTerritoryRow
      .mockRejectedValueOnce({ code: "P2002", meta: { target: ["code"] } })
      .mockResolvedValueOnce(baseTerritoryRow({ code: "TER-00002" }));

    const result = await createTerritory({ province: fresh("Équateur") }, "actor-1");

    expect(result.code).toBe("TER-00002");
    expect(createTerritoryRow).toHaveBeenCalledTimes(2);
  });
});

describe("findOrCreateTerritory", () => {
  it("reports created: false when a matching path already exists", async () => {
    findTerritoryByPathKey.mockResolvedValueOnce(baseTerritoryRow());

    const result = await findOrCreateTerritory(
      { provinceId: "province-1", villeId: null, communeId: null, quartierId: null },
      "actor-1",
    );

    expect(result.created).toBe(false);
    expect(createTerritoryRow).not.toHaveBeenCalled();
  });

  it("reports created: true when a new Territory row is written", async () => {
    findTerritoryByPathKey.mockResolvedValueOnce(null);
    createTerritoryRow.mockResolvedValueOnce(baseTerritoryRow());

    const result = await findOrCreateTerritory(
      { provinceId: "province-1", villeId: null, communeId: null, quartierId: null },
      "actor-1",
    );

    expect(result.created).toBe(true);
  });
});

describe("updateTerritoryEntry", () => {
  it("re-points a Territory to a different path", async () => {
    findTerritoryByPathKey.mockResolvedValueOnce(null);
    updateTerritoryRow.mockResolvedValueOnce(
      baseTerritoryRow({ ville: { id: "ville-2", name: "New Ville" } }),
    );

    await updateTerritoryEntry(
      { id: "territory-1", province: existing("province-1"), ville: existing("ville-1") },
      "actor-1",
    );

    expect(updateTerritoryRow).toHaveBeenCalledWith(
      "territory-1",
      expect.objectContaining({
        province: { connect: { id: "province-1" } },
        ville: { connect: { id: "ville-1" } },
        commune: { disconnect: true },
        quartier: { disconnect: true },
      }),
    );
  });

  it("toggles status without checking dependents when staying active", async () => {
    updateTerritoryRow.mockResolvedValueOnce(baseTerritoryRow({ status: "ACTIVE" }));

    await updateTerritoryEntry(
      { id: "territory-1", province: existing("province-1"), status: "ACTIVE" },
      "actor-1",
    );

    expect(countTerritoryDependents).not.toHaveBeenCalled();
  });

  it("rejects deactivation while active dependents remain", async () => {
    countTerritoryDependents.mockResolvedValueOnce({
      activeClients: 1,
      activeUsers: 0,
      activeAssignments: 0,
    });

    await expect(
      updateTerritoryEntry(
        { id: "territory-1", province: existing("province-1"), status: "INACTIVE" },
        "actor-1",
      ),
    ).rejects.toThrow(TerritoryInUseError);
    expect(updateTerritoryRow).not.toHaveBeenCalled();
  });

  it("maps a pathKey collision to DuplicateTerritoryPathError", async () => {
    updateTerritoryRow.mockRejectedValueOnce({ code: "P2002", meta: { target: ["pathKey"] } });

    await expect(
      updateTerritoryEntry({ id: "territory-1", province: existing("province-1") }, "actor-1"),
    ).rejects.toThrow(DuplicateTerritoryPathError);
  });
});

describe("listTerritories / getTerritory / listActiveTerritoryOptions", () => {
  it("maps territory rows to summaries", async () => {
    findTerritories.mockResolvedValueOnce([baseTerritoryRow()]);

    const result = await listTerritories({});

    expect(result).toEqual([
      {
        id: "territory-1",
        code: "TER-00001",
        status: "ACTIVE",
        province: { id: "province-1", name: "Équateur" },
        ville: null,
        commune: null,
        quartier: null,
      },
    ]);
  });

  it("returns null when a territory doesn't exist", async () => {
    findTerritoryById.mockResolvedValueOnce(null);
    await expect(getTerritory("missing")).resolves.toBeNull();
  });

  it("builds a joined label from whichever levels are present", async () => {
    listActiveTerritories.mockResolvedValueOnce([
      baseTerritoryRow({
        ville: { id: "ville-1", name: "Mbandaka" },
        commune: { id: "commune-1", name: "Wangata" },
      }),
    ]);

    const result = await listActiveTerritoryOptions();

    expect(result).toEqual([
      { id: "territory-1", code: "TER-00001", label: "Équateur › Mbandaka › Wangata" },
    ]);
  });
});
