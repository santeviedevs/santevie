import { beforeEach, describe, expect, it, vi } from "vitest";

const createProvince = vi.fn();
const createVille = vi.fn();
const createCommune = vi.fn();
const createQuartier = vi.fn();
const updateQuartier = vi.fn();
const updateVille = vi.fn();
const updateCommune = vi.fn();
const updateProvince = vi.fn();
const setQuartierStatus = vi.fn();
const countQuartierDependents = vi.fn();
const findVilleById = vi.fn();
const findCommuneById = vi.fn();
const findProvinceById = vi.fn();
const findTerritoryEntryById = vi.fn();
const setProvinceStatus = vi.fn();
const setVilleStatus = vi.fn();
const setCommuneStatus = vi.fn();
const getProvinceDescendantIds = vi.fn();
const getVilleDescendantIds = vi.fn();
const getCommuneDescendantIds = vi.fn();
const countActiveDependents = vi.fn();
const cascadeDeactivateProvince = vi.fn();
const cascadeDeactivateVille = vi.fn();
const cascadeDeactivateCommune = vi.fn();
const findQuartiers = vi.fn();
const findVilles = vi.fn();
const findCommunes = vi.fn();
const findProvinces = vi.fn();

vi.mock("@/server/repositories/territory-repository", () => ({
  createProvince,
  createVille,
  createCommune,
  createQuartier,
  updateQuartier,
  updateVille,
  updateCommune,
  updateProvince,
  setQuartierStatus,
  countQuartierDependents,
  findVilleById,
  findCommuneById,
  findProvinceById,
  findTerritoryEntryById,
  setProvinceStatus,
  setVilleStatus,
  setCommuneStatus,
  getProvinceDescendantIds,
  getVilleDescendantIds,
  getCommuneDescendantIds,
  countActiveDependents,
  cascadeDeactivateProvince,
  cascadeDeactivateVille,
  cascadeDeactivateCommune,
  findQuartiers,
  findVilles,
  findCommunes,
  findProvinces,
}));

const {
  createTerritory: createTerritoryService,
  updateTerritoryEntry: updateTerritoryEntryService,
  activateQuartier: activateQuartierService,
  deactivateQuartier: deactivateQuartierService,
  activateProvince: activateProvinceService,
  deactivateProvince: deactivateProvinceService,
  activateVille: activateVilleService,
  deactivateVille: deactivateVilleService,
  activateCommune: activateCommuneService,
  deactivateCommune: deactivateCommuneService,
  listTerritoryEntries,
  getTerritoryEntry,
  DuplicateTerritoryNameError,
  TerritoryInUseError,
  InvalidTerritoryHierarchyError,
  InactiveParentError,
} = await import("./territory-service");

const baseQuartierRow = (overrides: Record<string, unknown> = {}) => ({
  id: "quartier-1",
  name: "Bongondo",
  status: "ACTIVE",
  commune: {
    id: "commune-1",
    name: "Wangata",
    status: "ACTIVE",
    ville: { id: "ville-1", name: "Mbandaka", province: { id: "province-1", name: "Équateur" } },
  },
  ...overrides,
});

const baseCommuneRow = (overrides: Record<string, unknown> = {}) => ({
  id: "commune-1",
  name: "Wangata",
  status: "ACTIVE",
  ville: { id: "ville-1", name: "Mbandaka", province: { id: "province-1", name: "Équateur" } },
  ...overrides,
});

const baseVilleRow = (overrides: Record<string, unknown> = {}) => ({
  id: "ville-1",
  name: "Mbandaka",
  status: "ACTIVE",
  province: { id: "province-1", name: "Équateur" },
  ...overrides,
});

const baseProvinceRow = (overrides: Record<string, unknown> = {}) => ({
  id: "province-1",
  name: "Équateur",
  status: "ACTIVE",
  ...overrides,
});

const existing = (id: string) => ({ mode: "existing" as const, id });
const fresh = (name: string) => ({ mode: "new" as const, name });

beforeEach(() => {
  vi.clearAllMocks();
  // Matches the province-1/ville-1/commune-1/quartier-1 chain most tests
  // below submit as "existing" — individual tests override this when they
  // need a mismatched or missing ancestor, or a different final entry.
  findVilleById.mockResolvedValue({ id: "ville-1", provinceId: "province-1", status: "ACTIVE" });
  findCommuneById.mockResolvedValue({ id: "commune-1", villeId: "ville-1", status: "ACTIVE" });
  findProvinceById.mockResolvedValue({ id: "province-1", status: "ACTIVE" });
  // createTerritory/updateTerritoryEntry both refetch the final entry via
  // findTerritoryEntryById once they're done.
  findTerritoryEntryById.mockResolvedValue({ level: "quartier", row: baseQuartierRow() });
  getProvinceDescendantIds.mockResolvedValue({ villeIds: [], communeIds: [], quartierIds: [] });
  getVilleDescendantIds.mockResolvedValue({ communeIds: [], quartierIds: [] });
  getCommuneDescendantIds.mockResolvedValue({ quartierIds: [] });
  countActiveDependents.mockResolvedValue({ activeClients: 0, activeUsers: 0 });
});

describe("createTerritory", () => {
  it("creates a Quartier entirely under existing ancestors", async () => {
    createQuartier.mockResolvedValueOnce(baseQuartierRow());

    const result = await createTerritoryService(
      {
        province: existing("province-1"),
        ville: existing("ville-1"),
        commune: existing("commune-1"),
        quartierName: "Bongondo",
      },
      "actor-1",
    );

    expect(result).toMatchObject({ level: "quartier", name: "Bongondo" });
    expect(createProvince).not.toHaveBeenCalled();
    expect(createVille).not.toHaveBeenCalled();
    expect(createCommune).not.toHaveBeenCalled();
    expect(createQuartier).toHaveBeenCalledWith(
      expect.objectContaining({ commune: { connect: { id: "commune-1" } } }),
    );
  });

  it("creates the full ancestor chain when every level is new", async () => {
    createProvince.mockResolvedValueOnce({ id: "new-province" });
    createVille.mockResolvedValueOnce({ id: "new-ville" });
    createCommune.mockResolvedValueOnce({ id: "new-commune" });
    createQuartier.mockResolvedValueOnce(baseQuartierRow({ id: "new-quartier" }));

    await createTerritoryService(
      {
        province: fresh("Équateur"),
        ville: fresh("Mbandaka"),
        commune: fresh("Wangata"),
        quartierName: "Bongondo",
      },
      "actor-1",
    );

    expect(createProvince).toHaveBeenCalledWith(expect.objectContaining({ name: "Équateur" }));
    expect(createVille).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Mbandaka", province: { connect: { id: "new-province" } } }),
    );
    expect(createCommune).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Wangata", ville: { connect: { id: "new-ville" } } }),
    );
    expect(createQuartier).toHaveBeenCalledWith(
      expect.objectContaining({ commune: { connect: { id: "new-commune" } } }),
    );
  });

  it("stops at Province when Ville is omitted", async () => {
    createProvince.mockResolvedValueOnce({ id: "new-province" });
    findTerritoryEntryById.mockResolvedValueOnce({
      level: "province",
      row: baseProvinceRow({ id: "new-province", name: "Équateur" }),
    });

    const result = await createTerritoryService({ province: fresh("Équateur") }, "actor-1");

    expect(result).toMatchObject({ level: "province", name: "Équateur" });
    expect(createVille).not.toHaveBeenCalled();
    expect(createCommune).not.toHaveBeenCalled();
    expect(createQuartier).not.toHaveBeenCalled();
  });

  it("stops at Ville when Commune is omitted", async () => {
    createVille.mockResolvedValueOnce({ id: "new-ville" });
    findTerritoryEntryById.mockResolvedValueOnce({
      level: "ville",
      row: baseVilleRow({ id: "new-ville", name: "Mbandaka" }),
    });

    const result = await createTerritoryService(
      { province: existing("province-1"), ville: fresh("Mbandaka") },
      "actor-1",
    );

    expect(result).toMatchObject({ level: "ville", name: "Mbandaka" });
    expect(createCommune).not.toHaveBeenCalled();
    expect(createQuartier).not.toHaveBeenCalled();
  });

  it("stops at Commune when Quartier's name is omitted", async () => {
    createCommune.mockResolvedValueOnce({ id: "new-commune" });
    findTerritoryEntryById.mockResolvedValueOnce({
      level: "commune",
      row: baseCommuneRow({ id: "new-commune", name: "Wangata" }),
    });

    const result = await createTerritoryService(
      { province: existing("province-1"), ville: existing("ville-1"), commune: fresh("Wangata") },
      "actor-1",
    );

    expect(result).toMatchObject({ level: "commune", name: "Wangata" });
    expect(createQuartier).not.toHaveBeenCalled();
  });

  it("resolves a new ville under an existing province", async () => {
    createVille.mockResolvedValueOnce({ id: "new-ville" });
    createCommune.mockResolvedValueOnce({ id: "new-commune" });
    createQuartier.mockResolvedValueOnce(baseQuartierRow());

    await createTerritoryService(
      {
        province: existing("province-1"),
        ville: fresh("Mbandaka"),
        commune: fresh("Wangata"),
        quartierName: "Bongondo",
      },
      "actor-1",
    );

    expect(createProvince).not.toHaveBeenCalled();
    expect(createVille).toHaveBeenCalledWith(
      expect.objectContaining({ province: { connect: { id: "province-1" } } }),
    );
  });

  it("maps a duplicate name constraint on the new province to DuplicateTerritoryNameError", async () => {
    createProvince.mockRejectedValueOnce({ code: "P2002" });

    await expect(
      createTerritoryService(
        {
          province: fresh("Équateur"),
          ville: fresh("Mbandaka"),
          commune: fresh("Wangata"),
          quartierName: "Bongondo",
        },
        "actor-1",
      ),
    ).rejects.toThrow(DuplicateTerritoryNameError);
  });

  it("rejects an existing ville that belongs to a different province", async () => {
    findVilleById.mockResolvedValueOnce({ id: "ville-1", provinceId: "some-other-province" });

    await expect(
      createTerritoryService(
        {
          province: existing("province-1"),
          ville: existing("ville-1"),
          commune: existing("commune-1"),
          quartierName: "Bongondo",
        },
        "actor-1",
      ),
    ).rejects.toThrow(InvalidTerritoryHierarchyError);
    expect(createQuartier).not.toHaveBeenCalled();
  });

  it("rejects an existing ville id that no longer exists", async () => {
    findVilleById.mockResolvedValueOnce(null);

    await expect(
      createTerritoryService(
        {
          province: existing("province-1"),
          ville: existing("ville-1"),
          commune: existing("commune-1"),
          quartierName: "Bongondo",
        },
        "actor-1",
      ),
    ).rejects.toThrow(InvalidTerritoryHierarchyError);
  });

  it("rejects an existing commune that belongs to a different ville", async () => {
    findCommuneById.mockResolvedValueOnce({ id: "commune-1", villeId: "some-other-ville" });

    await expect(
      createTerritoryService(
        {
          province: existing("province-1"),
          ville: existing("ville-1"),
          commune: existing("commune-1"),
          quartierName: "Bongondo",
        },
        "actor-1",
      ),
    ).rejects.toThrow(InvalidTerritoryHierarchyError);
    expect(createQuartier).not.toHaveBeenCalled();
  });

  it("validates a newly created ville's parent commune against the resolved ville, not the submitted one", async () => {
    createCommune.mockResolvedValueOnce({ id: "new-commune" });
    createQuartier.mockResolvedValueOnce(baseQuartierRow());

    await createTerritoryService(
      {
        province: existing("province-1"),
        ville: existing("ville-1"),
        commune: fresh("Wangata"),
        quartierName: "Bongondo",
      },
      "actor-1",
    );

    expect(findCommuneById).not.toHaveBeenCalled();
    expect(createCommune).toHaveBeenCalledWith(
      expect.objectContaining({ ville: { connect: { id: "ville-1" } } }),
    );
  });

  it("rethrows an unrelated error unchanged", async () => {
    createQuartier.mockRejectedValueOnce(new Error("connection lost"));

    await expect(
      createTerritoryService(
        {
          province: existing("province-1"),
          ville: existing("ville-1"),
          commune: existing("commune-1"),
          quartierName: "Bongondo",
        },
        "actor-1",
      ),
    ).rejects.toThrow("connection lost");
  });
});

describe("updateTerritoryEntry", () => {
  it("rejects a Quartier save that sets status to INACTIVE while active clients or users remain", async () => {
    countQuartierDependents.mockResolvedValueOnce({ activeClients: 1, activeUsers: 0 });

    await expect(
      updateTerritoryEntryService(
        {
          id: "quartier-1",
          level: "quartier",
          province: existing("province-1"),
          ville: existing("ville-1"),
          commune: existing("commune-1"),
          name: "Bongondo",
          status: "INACTIVE",
        },
        "actor-1",
      ),
    ).rejects.toThrow(TerritoryInUseError);
    expect(updateQuartier).not.toHaveBeenCalled();
  });

  it("re-parents a Quartier under a newly created commune", async () => {
    createCommune.mockResolvedValueOnce({ id: "new-commune" });
    updateQuartier.mockResolvedValueOnce(baseQuartierRow());

    await updateTerritoryEntryService(
      {
        id: "quartier-1",
        level: "quartier",
        province: existing("province-1"),
        ville: existing("ville-1"),
        commune: fresh("New Commune"),
        name: "Bongondo",
      },
      "actor-1",
    );

    expect(updateQuartier).toHaveBeenCalledWith(
      "quartier-1",
      expect.objectContaining({ commune: { connect: { id: "new-commune" } } }),
    );
  });

  it("rejects an existing commune that doesn't belong to the selected ville", async () => {
    findCommuneById.mockResolvedValueOnce({ id: "commune-1", villeId: "some-other-ville" });

    await expect(
      updateTerritoryEntryService(
        {
          id: "quartier-1",
          level: "quartier",
          province: existing("province-1"),
          ville: existing("ville-1"),
          commune: existing("commune-1"),
          name: "Bongondo",
        },
        "actor-1",
      ),
    ).rejects.toThrow(InvalidTerritoryHierarchyError);
    expect(updateQuartier).not.toHaveBeenCalled();
  });

  it("does not check dependents when status is left unchanged", async () => {
    updateQuartier.mockResolvedValueOnce(baseQuartierRow());

    await updateTerritoryEntryService(
      {
        id: "quartier-1",
        level: "quartier",
        province: existing("province-1"),
        ville: existing("ville-1"),
        commune: existing("commune-1"),
        name: "Bongondo",
      },
      "actor-1",
    );

    expect(countQuartierDependents).not.toHaveBeenCalled();
  });

  it("renames a Province-level entry without touching any ancestor field", async () => {
    updateProvince.mockResolvedValueOnce(baseProvinceRow());
    findTerritoryEntryById.mockResolvedValue({ level: "province", row: baseProvinceRow() });

    await updateTerritoryEntryService(
      { id: "province-1", level: "province", name: "Nouvel Équateur" },
      "actor-1",
    );

    expect(updateProvince).toHaveBeenCalledWith("province-1", {
      name: "Nouvel Équateur",
      updatedBy: "actor-1",
    });
  });

  it("renames a Ville-level entry and can re-parent it to a different Province", async () => {
    updateVille.mockResolvedValueOnce(baseVilleRow());
    findTerritoryEntryById.mockResolvedValue({ level: "ville", row: baseVilleRow() });

    await updateTerritoryEntryService(
      {
        id: "ville-1",
        level: "ville",
        province: existing("province-2"),
        name: "Nouvelle Mbandaka",
      },
      "actor-1",
    );

    expect(updateVille).toHaveBeenCalledWith("ville-1", {
      name: "Nouvelle Mbandaka",
      province: { connect: { id: "province-2" } },
      updatedBy: "actor-1",
    });
  });

  it("renames a Commune-level entry", async () => {
    updateCommune.mockResolvedValueOnce(baseCommuneRow());
    findTerritoryEntryById.mockResolvedValue({ level: "commune", row: baseCommuneRow() });

    await updateTerritoryEntryService(
      {
        id: "commune-1",
        level: "commune",
        province: existing("province-1"),
        ville: existing("ville-1"),
        name: "Nouvelle Wangata",
      },
      "actor-1",
    );

    expect(updateCommune).toHaveBeenCalledWith("commune-1", {
      name: "Nouvelle Wangata",
      ville: { connect: { id: "ville-1" } },
      updatedBy: "actor-1",
    });
  });

  it("grows a new Ville, Commune, and Quartier below a Province in the same save", async () => {
    updateProvince.mockResolvedValueOnce(baseProvinceRow());
    createVille.mockResolvedValueOnce({ id: "new-ville" });
    createCommune.mockResolvedValueOnce({ id: "new-commune" });
    createQuartier.mockResolvedValueOnce(baseQuartierRow());
    findTerritoryEntryById.mockResolvedValue({ level: "province", row: baseProvinceRow() });

    await updateTerritoryEntryService(
      {
        id: "province-1",
        level: "province",
        name: "Équateur",
        newVille: fresh("Mbandaka"),
        newCommune: fresh("Wangata"),
        newQuartierName: "Bongondo",
      },
      "actor-1",
    );

    expect(createVille).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Mbandaka", province: { connect: { id: "province-1" } } }),
    );
    expect(createCommune).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Wangata", ville: { connect: { id: "new-ville" } } }),
    );
    expect(createQuartier).toHaveBeenCalledWith(
      expect.objectContaining({ commune: { connect: { id: "new-commune" } } }),
    );
  });

  it("grows a new Quartier below a Commune directly", async () => {
    updateCommune.mockResolvedValueOnce(baseCommuneRow());
    createQuartier.mockResolvedValueOnce(baseQuartierRow());

    await updateTerritoryEntryService(
      {
        id: "commune-1",
        level: "commune",
        province: existing("province-1"),
        ville: existing("ville-1"),
        name: "Wangata",
        newQuartierName: "Bongondo",
      },
      "actor-1",
    );

    expect(createQuartier).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Bongondo", commune: { connect: { id: "commune-1" } } }),
    );
  });

  it("does not grow anything when no downstream fields are given", async () => {
    updateProvince.mockResolvedValueOnce(baseProvinceRow());

    await updateTerritoryEntryService(
      { id: "province-1", level: "province", name: "Équateur" },
      "actor-1",
    );

    expect(createVille).not.toHaveBeenCalled();
    expect(createCommune).not.toHaveBeenCalled();
    expect(createQuartier).not.toHaveBeenCalled();
  });

  it("cascades an ancestor Commune deactivation requested alongside a Quartier edit", async () => {
    updateQuartier.mockResolvedValueOnce(baseQuartierRow());
    getCommuneDescendantIds.mockResolvedValueOnce({ quartierIds: ["quartier-1"] });

    await updateTerritoryEntryService(
      {
        id: "quartier-1",
        level: "quartier",
        province: existing("province-1"),
        ville: existing("ville-1"),
        commune: existing("commune-1"),
        name: "Bongondo",
        communeStatus: "INACTIVE",
      },
      "actor-1",
    );

    expect(cascadeDeactivateCommune).toHaveBeenCalledWith(
      "commune-1",
      { quartierIds: ["quartier-1"] },
      "actor-1",
    );
  });

  it("ignores an ancestor status for a level that's being created fresh", async () => {
    createCommune.mockResolvedValueOnce({ id: "new-commune" });
    updateQuartier.mockResolvedValueOnce(baseQuartierRow());

    await updateTerritoryEntryService(
      {
        id: "quartier-1",
        level: "quartier",
        province: existing("province-1"),
        ville: existing("ville-1"),
        commune: fresh("New Commune"),
        name: "Bongondo",
        // The form never actually sends this for "new" mode, but the
        // service shouldn't act on it even if it somehow arrived.
        communeStatus: "INACTIVE",
      },
      "actor-1",
    );

    expect(cascadeDeactivateCommune).not.toHaveBeenCalled();
    expect(setCommuneStatus).not.toHaveBeenCalled();
  });

  it("rejects setting a Quartier active while its Commune is inactive", async () => {
    findCommuneById.mockResolvedValue({ id: "commune-1", villeId: "ville-1", status: "INACTIVE" });
    updateQuartier.mockResolvedValueOnce(baseQuartierRow());
    findTerritoryEntryById.mockResolvedValueOnce({
      level: "quartier",
      row: baseQuartierRow({ commune: { ...baseQuartierRow().commune, status: "INACTIVE" } }),
    });

    await expect(
      updateTerritoryEntryService(
        {
          id: "quartier-1",
          level: "quartier",
          province: existing("province-1"),
          ville: existing("ville-1"),
          commune: existing("commune-1"),
          name: "Bongondo",
          status: "ACTIVE",
        },
        "actor-1",
      ),
    ).rejects.toThrow(InactiveParentError);
    expect(setQuartierStatus).not.toHaveBeenCalled();
  });
});

describe("activateQuartier", () => {
  it("sets the status to ACTIVE without checking dependents", async () => {
    setQuartierStatus.mockResolvedValueOnce(baseQuartierRow({ status: "ACTIVE" }));

    await activateQuartierService("quartier-1", "actor-1");

    expect(setQuartierStatus).toHaveBeenCalledWith("quartier-1", "ACTIVE", "actor-1");
    expect(countQuartierDependents).not.toHaveBeenCalled();
  });

  it("rejects activation while the parent commune is inactive", async () => {
    findTerritoryEntryById.mockResolvedValueOnce({
      level: "quartier",
      row: baseQuartierRow({ commune: { ...baseQuartierRow().commune, status: "INACTIVE" } }),
    });

    await expect(activateQuartierService("quartier-1", "actor-1")).rejects.toThrow(
      InactiveParentError,
    );
    expect(setQuartierStatus).not.toHaveBeenCalled();
  });
});

describe("deactivateQuartier", () => {
  it("deactivates a Quartier with nothing active assigned", async () => {
    countQuartierDependents.mockResolvedValueOnce({ activeClients: 0, activeUsers: 0 });
    setQuartierStatus.mockResolvedValueOnce(baseQuartierRow({ status: "INACTIVE" }));

    await deactivateQuartierService("quartier-1", "actor-1");

    expect(setQuartierStatus).toHaveBeenCalledWith("quartier-1", "INACTIVE", "actor-1");
  });

  it("rejects deactivation while active clients are assigned", async () => {
    countQuartierDependents.mockResolvedValueOnce({ activeClients: 2, activeUsers: 0 });

    await expect(deactivateQuartierService("quartier-1", "actor-1")).rejects.toThrow(
      TerritoryInUseError,
    );
    expect(setQuartierStatus).not.toHaveBeenCalled();
  });

  it("rejects deactivation while active users are assigned", async () => {
    countQuartierDependents.mockResolvedValueOnce({ activeClients: 0, activeUsers: 3 });

    await expect(deactivateQuartierService("quartier-1", "actor-1")).rejects.toThrow(
      TerritoryInUseError,
    );
    expect(setQuartierStatus).not.toHaveBeenCalled();
  });

  it("rejects deactivation while a territory assignment still references it (S2-04)", async () => {
    countQuartierDependents.mockResolvedValueOnce({
      activeClients: 0,
      activeUsers: 0,
      activeAssignments: 1,
    });

    await expect(deactivateQuartierService("quartier-1", "actor-1")).rejects.toThrow(
      TerritoryInUseError,
    );
    expect(setQuartierStatus).not.toHaveBeenCalled();
  });
});

describe("deactivateProvince", () => {
  it("cascades to every descendant Ville, Commune, and Quartier", async () => {
    getProvinceDescendantIds.mockResolvedValueOnce({
      villeIds: ["ville-1", "ville-2"],
      communeIds: ["commune-1"],
      quartierIds: ["quartier-1"],
    });

    await deactivateProvinceService("province-1", "actor-1");

    expect(countActiveDependents).toHaveBeenCalledWith({
      provinceIds: ["province-1"],
      villeIds: ["ville-1", "ville-2"],
      communeIds: ["commune-1"],
      quartierIds: ["quartier-1"],
    });
    expect(cascadeDeactivateProvince).toHaveBeenCalledWith(
      "province-1",
      { villeIds: ["ville-1", "ville-2"], communeIds: ["commune-1"], quartierIds: ["quartier-1"] },
      "actor-1",
    );
  });

  it("rejects deactivation while an active user or client exists anywhere in the subtree", async () => {
    getProvinceDescendantIds.mockResolvedValueOnce({
      villeIds: ["ville-1"],
      communeIds: ["commune-1"],
      quartierIds: ["quartier-1"],
    });
    countActiveDependents.mockResolvedValueOnce({ activeClients: 0, activeUsers: 1 });

    await expect(deactivateProvinceService("province-1", "actor-1")).rejects.toThrow(
      TerritoryInUseError,
    );
    expect(cascadeDeactivateProvince).not.toHaveBeenCalled();
  });
});

describe("activateProvince", () => {
  it("sets the status to ACTIVE without touching descendants", async () => {
    await activateProvinceService("province-1", "actor-1");

    expect(setProvinceStatus).toHaveBeenCalledWith("province-1", "ACTIVE", "actor-1");
    expect(cascadeDeactivateProvince).not.toHaveBeenCalled();
  });
});

describe("deactivateVille", () => {
  it("cascades to descendant Communes and Quartiers", async () => {
    getVilleDescendantIds.mockResolvedValueOnce({
      communeIds: ["commune-1"],
      quartierIds: ["quartier-1"],
    });

    await deactivateVilleService("ville-1", "actor-1");

    expect(countActiveDependents).toHaveBeenCalledWith({
      villeIds: ["ville-1"],
      communeIds: ["commune-1"],
      quartierIds: ["quartier-1"],
    });
    expect(cascadeDeactivateVille).toHaveBeenCalledWith(
      "ville-1",
      { communeIds: ["commune-1"], quartierIds: ["quartier-1"] },
      "actor-1",
    );
  });

  it("rejects deactivation while a descendant Quartier has an active client", async () => {
    getVilleDescendantIds.mockResolvedValueOnce({ communeIds: [], quartierIds: ["quartier-1"] });
    countActiveDependents.mockResolvedValueOnce({ activeClients: 1, activeUsers: 0 });

    await expect(deactivateVilleService("ville-1", "actor-1")).rejects.toThrow(TerritoryInUseError);
    expect(cascadeDeactivateVille).not.toHaveBeenCalled();
  });
});

describe("activateVille", () => {
  it("sets the status to ACTIVE when the parent Province is active", async () => {
    await activateVilleService("ville-1", "actor-1");
    expect(setVilleStatus).toHaveBeenCalledWith("ville-1", "ACTIVE", "actor-1");
  });

  it("rejects activation while the parent Province is inactive", async () => {
    findProvinceById.mockResolvedValueOnce({ id: "province-1", status: "INACTIVE" });

    await expect(activateVilleService("ville-1", "actor-1")).rejects.toThrow(InactiveParentError);
    expect(setVilleStatus).not.toHaveBeenCalled();
  });
});

describe("deactivateCommune", () => {
  it("cascades to descendant Quartiers", async () => {
    getCommuneDescendantIds.mockResolvedValueOnce({ quartierIds: ["quartier-1", "quartier-2"] });

    await deactivateCommuneService("commune-1", "actor-1");

    expect(countActiveDependents).toHaveBeenCalledWith({
      communeIds: ["commune-1"],
      quartierIds: ["quartier-1", "quartier-2"],
    });
    expect(cascadeDeactivateCommune).toHaveBeenCalledWith(
      "commune-1",
      { quartierIds: ["quartier-1", "quartier-2"] },
      "actor-1",
    );
  });

  it("rejects deactivation while an active user remains", async () => {
    countActiveDependents.mockResolvedValueOnce({ activeClients: 0, activeUsers: 2 });

    await expect(deactivateCommuneService("commune-1", "actor-1")).rejects.toThrow(
      TerritoryInUseError,
    );
    expect(cascadeDeactivateCommune).not.toHaveBeenCalled();
  });
});

describe("activateCommune", () => {
  it("sets the status to ACTIVE when the parent Ville is active", async () => {
    await activateCommuneService("commune-1", "actor-1");
    expect(setCommuneStatus).toHaveBeenCalledWith("commune-1", "ACTIVE", "actor-1");
  });

  it("rejects activation while the parent Ville is inactive", async () => {
    findVilleById.mockResolvedValueOnce({
      id: "ville-1",
      provinceId: "province-1",
      status: "INACTIVE",
    });

    await expect(activateCommuneService("commune-1", "actor-1")).rejects.toThrow(
      InactiveParentError,
    );
    expect(setCommuneStatus).not.toHaveBeenCalled();
  });
});

describe("getTerritoryEntry", () => {
  it("returns null when no level matches the id", async () => {
    findTerritoryEntryById.mockResolvedValueOnce(null);

    await expect(getTerritoryEntry("missing-id")).resolves.toBeNull();
  });

  it("maps a Ville row to an entry with only its Province as ancestry", async () => {
    findTerritoryEntryById.mockResolvedValueOnce({ level: "ville", row: baseVilleRow() });

    await expect(getTerritoryEntry("ville-1")).resolves.toMatchObject({
      level: "ville",
      name: "Mbandaka",
      province: { id: "province-1", name: "Équateur" },
      ville: null,
      commune: null,
    });
  });
});

describe("listTerritoryEntries", () => {
  it("combines all four levels into one sorted list", async () => {
    findProvinces.mockResolvedValueOnce([baseProvinceRow({ id: "p2", name: "Zaire" })]);
    findVilles.mockResolvedValueOnce([baseVilleRow({ id: "v2", name: "Alpha" })]);
    findCommunes.mockResolvedValueOnce([]);
    findQuartiers.mockResolvedValueOnce([]);

    const result = await listTerritoryEntries({});

    expect(result.map((entry) => entry.name)).toEqual(["Alpha", "Zaire"]);
  });

  it("skips querying Province and Ville levels when a communeId filter is set", async () => {
    findCommunes.mockResolvedValueOnce([]);
    findQuartiers.mockResolvedValueOnce([]);

    await listTerritoryEntries({ communeId: "commune-1" });

    expect(findProvinces).not.toHaveBeenCalled();
    expect(findVilles).not.toHaveBeenCalled();
  });

  it("skips querying the Province level when a villeId filter is set", async () => {
    findVilles.mockResolvedValueOnce([]);
    findCommunes.mockResolvedValueOnce([]);
    findQuartiers.mockResolvedValueOnce([]);

    await listTerritoryEntries({ villeId: "ville-1" });

    expect(findProvinces).not.toHaveBeenCalled();
    expect(findVilles).toHaveBeenCalled();
  });
});
