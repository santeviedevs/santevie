import { beforeEach, describe, expect, it, vi } from "vitest";

const findPersons = vi.fn();
const countPersons = vi.fn();
const findPersonById = vi.fn();
const findPersonCenterLinks = vi.fn();
const findPersonReferenceIds = vi.fn();
const createPersonWithCenters = vi.fn();
const updatePersonWithCenters = vi.fn();
const setPersonStatusRow = vi.fn();
const nextPersonCodeNumber = vi.fn();
const findPersonTypeById = vi.fn();
const findSpecializationById = vi.fn();
const findCentersByIds = vi.fn();
const findCenterRolesByIds = vi.fn();
const findLookupByCode = vi.fn();
const createLookup = vi.fn();

vi.mock("@/server/repositories/person-repository", () => ({
  findPersons,
  countPersons,
  findPersonById,
  findPersonCenterLinks,
  findPersonReferenceIds,
  createPersonWithCenters,
  updatePersonWithCenters,
  setPersonStatus: setPersonStatusRow,
  nextPersonCodeNumber,
  findPersonTypeById,
  findSpecializationById,
  findCentersByIds,
  findCenterRolesByIds,
  findLookupByCode,
  createLookup,
  listPersonTypes: vi.fn(),
  listSpecializations: vi.fn(),
  listCenterRoles: vi.fn(),
}));

vi.mock("@/server/repositories/client-repository", () => ({
  listActiveClientsForSelection: vi.fn(),
  listClientTypes: vi.fn(),
}));

const findTerritoryById = vi.fn();
vi.mock("@/server/repositories/territory-repository", () => ({ findTerritoryById }));
vi.mock("@/server/services/territory-service", () => ({ listActiveTerritoryOptions: vi.fn() }));

const {
  createPerson,
  updatePerson,
  listPersons,
  setPersonStatus,
  createLookupValue,
  slugifyLookupName,
  formatPersonCode,
  DuplicatePersonCenterError,
  InactivePersonReferenceError,
  InvalidPersonReferenceError,
  InvalidLookupNameError,
  PersonNotFoundError,
} = await import("./person-service");

const territoryRow = {
  id: "ter-1",
  code: "TER-00001",
  status: "ACTIVE",
  province: { id: "p", name: "Province A" },
  ville: { id: "v", name: "Ville B" },
  commune: null,
  quartier: null,
};

const detailRow = (overrides: Record<string, unknown> = {}) => ({
  id: "person-1",
  code: "PER-00001",
  name: "Dr Test",
  gender: null,
  mobile: null,
  status: "ACTIVE",
  personType: { id: "pt-1", code: "MEDECIN", name: "MÉDECIN" },
  specialization: { id: "sp-1", code: "CARDIO", name: "Cardiology" },
  territory: territoryRow,
  centers: [
    {
      client: {
        id: "c-1",
        code: "CL-1",
        name: "Hospital X",
        status: "ACTIVE",
        type: { id: "ct-1", code: "HOSPITAL", name: "Hospital" },
      },
      roleAtCenter: { id: "r-1", code: "DOCTOR", name: "Doctor" },
    },
  ],
  _count: { centers: 1 },
  ...overrides,
});

const baseInput = {
  name: "Dr Test",
  personTypeId: "pt-1",
  specializationId: "sp-1",
  territoryId: "ter-1",
  centers: [{ clientId: "c-1", roleAtCenterId: "r-1" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  findPersonTypeById.mockResolvedValue({ id: "pt-1" });
  findSpecializationById.mockResolvedValue({ id: "sp-1" });
  findTerritoryById.mockResolvedValue(territoryRow);
  findCentersByIds.mockResolvedValue([{ id: "c-1", status: "ACTIVE" }]);
  findCenterRolesByIds.mockResolvedValue([{ id: "r-1" }]);
  nextPersonCodeNumber.mockResolvedValue(1);
  createPersonWithCenters.mockResolvedValue(detailRow());
  updatePersonWithCenters.mockResolvedValue(detailRow());
});

describe("formatPersonCode", () => {
  it("pads the sequence number", () => {
    expect(formatPersonCode(7)).toBe("PER-00007");
    expect(formatPersonCode(12345)).toBe("PER-12345");
  });
});

describe("createPerson", () => {
  it("generates the code on the backend and returns the Territory path", async () => {
    nextPersonCodeNumber.mockResolvedValue(42);
    createPersonWithCenters.mockResolvedValue(detailRow({ code: "PER-00042" }));

    const result = await createPerson(baseInput, "actor-1");

    expect(createPersonWithCenters).toHaveBeenCalledWith(
      expect.objectContaining({ code: "PER-00042", name: "Dr Test" }),
      baseInput.centers,
      "actor-1",
    );
    expect(result.code).toBe("PER-00042");
    expect(result.territory.label).toBe("Province A › Ville B");
    expect(result.centers[0]).toMatchObject({ roleName: "Doctor", typeName: "Hospital" });
  });

  it("retries with the next sequence value when the code collides", async () => {
    nextPersonCodeNumber.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    createPersonWithCenters
      .mockRejectedValueOnce({ code: "P2002", meta: { target: ["code"] } })
      .mockResolvedValueOnce(detailRow({ code: "PER-00002" }));

    const result = await createPerson(baseInput, "actor-1");

    expect(createPersonWithCenters).toHaveBeenCalledTimes(2);
    expect(result.code).toBe("PER-00002");
  });

  it("rejects the same Center twice", async () => {
    await expect(
      createPerson(
        {
          ...baseInput,
          centers: [
            { clientId: "c-1", roleAtCenterId: "r-1" },
            { clientId: "c-1", roleAtCenterId: "r-2" },
          ],
        },
        "actor-1",
      ),
    ).rejects.toBeInstanceOf(DuplicatePersonCenterError);
    expect(createPersonWithCenters).not.toHaveBeenCalled();
  });

  it("allows one Person at several Centers with a different role each", async () => {
    findCentersByIds.mockResolvedValue([
      { id: "c-1", status: "ACTIVE" },
      { id: "c-2", status: "ACTIVE" },
    ]);
    findCenterRolesByIds.mockResolvedValue([{ id: "r-1" }, { id: "r-2" }]);
    const centers = [
      { clientId: "c-1", roleAtCenterId: "r-1" },
      { clientId: "c-2", roleAtCenterId: "r-2" },
    ];

    await createPerson({ ...baseInput, centers }, "actor-1");

    expect(createPersonWithCenters).toHaveBeenCalledWith(expect.anything(), centers, "actor-1");
  });

  it("rejects an inactive Territory", async () => {
    findTerritoryById.mockResolvedValue({ ...territoryRow, status: "INACTIVE" });
    await expect(createPerson(baseInput, "a")).rejects.toBeInstanceOf(InactivePersonReferenceError);
  });

  it("rejects an inactive Center", async () => {
    findCentersByIds.mockResolvedValue([{ id: "c-1", status: "INACTIVE" }]);
    await expect(createPerson(baseInput, "a")).rejects.toBeInstanceOf(InactivePersonReferenceError);
  });

  it("rejects unknown references", async () => {
    findPersonTypeById.mockResolvedValue(null);
    await expect(createPerson(baseInput, "a")).rejects.toBeInstanceOf(InvalidPersonReferenceError);

    findPersonTypeById.mockResolvedValue({ id: "pt-1" });
    findSpecializationById.mockResolvedValue(null);
    await expect(createPerson(baseInput, "a")).rejects.toBeInstanceOf(InvalidPersonReferenceError);

    findSpecializationById.mockResolvedValue({ id: "sp-1" });
    findTerritoryById.mockResolvedValue(null);
    await expect(createPerson(baseInput, "a")).rejects.toBeInstanceOf(InvalidPersonReferenceError);

    findTerritoryById.mockResolvedValue(territoryRow);
    findCentersByIds.mockResolvedValue([]);
    await expect(createPerson(baseInput, "a")).rejects.toBeInstanceOf(InvalidPersonReferenceError);

    findCentersByIds.mockResolvedValue([{ id: "c-1", status: "ACTIVE" }]);
    findCenterRolesByIds.mockResolvedValue([]);
    await expect(createPerson(baseInput, "a")).rejects.toBeInstanceOf(InvalidPersonReferenceError);
  });
});

describe("updatePerson", () => {
  const updateInput = { ...baseInput, id: "person-1" };

  beforeEach(() => {
    findPersonReferenceIds.mockResolvedValue({
      personTypeId: "pt-1",
      specializationId: "sp-1",
      territoryId: "ter-1",
    });
    findPersonCenterLinks.mockResolvedValue([{ clientId: "c-1", roleAtCenterId: "r-1" }]);
  });

  it("never sends a code, so it stays immutable", async () => {
    await updatePerson(updateInput, "actor-1");

    const data = updatePersonWithCenters.mock.calls[0]![1];
    expect(data).not.toHaveProperty("code");
    expect(nextPersonCodeNumber).not.toHaveBeenCalled();
  });

  it("passes the replaced association set, including changed roles", async () => {
    findCenterRolesByIds.mockResolvedValue([{ id: "r-9" }]);
    const centers = [{ clientId: "c-1", roleAtCenterId: "r-9" }];

    await updatePerson({ ...updateInput, centers }, "actor-1");

    expect(updatePersonWithCenters).toHaveBeenCalledWith(
      "person-1",
      expect.anything(),
      centers,
      "actor-1",
    );
  });

  it("does not block saving when an untouched existing Center was later deactivated", async () => {
    findCentersByIds.mockResolvedValue([{ id: "c-1", status: "INACTIVE" }]);
    await expect(updatePerson(updateInput, "actor-1")).resolves.toBeDefined();
  });

  it("rejects a newly added inactive Center", async () => {
    findCentersByIds.mockResolvedValue([
      { id: "c-1", status: "ACTIVE" },
      { id: "c-2", status: "INACTIVE" },
    ]);
    findCenterRolesByIds.mockResolvedValue([{ id: "r-1" }]);
    await expect(
      updatePerson(
        {
          ...updateInput,
          centers: [
            { clientId: "c-1", roleAtCenterId: "r-1" },
            { clientId: "c-2", roleAtCenterId: "r-1" },
          ],
        },
        "actor-1",
      ),
    ).rejects.toBeInstanceOf(InactivePersonReferenceError);
  });

  it("allows keeping an inactive current Territory but rejects switching to one", async () => {
    findTerritoryById.mockResolvedValue({ ...territoryRow, status: "INACTIVE" });
    await expect(updatePerson(updateInput, "actor-1")).resolves.toBeDefined();

    findPersonReferenceIds.mockResolvedValue({
      personTypeId: "pt-1",
      specializationId: "sp-1",
      territoryId: "other-territory",
    });
    await expect(updatePerson(updateInput, "actor-1")).rejects.toBeInstanceOf(
      InactivePersonReferenceError,
    );
  });

  it("throws for a missing Person", async () => {
    findPersonReferenceIds.mockResolvedValue(null);
    await expect(updatePerson(updateInput, "actor-1")).rejects.toBeInstanceOf(PersonNotFoundError);
  });
});

describe("listPersons", () => {
  it("is organisation-wide: filters go straight to the query with no user scope", async () => {
    findPersons.mockResolvedValue([detailRow()]);
    countPersons.mockResolvedValue(1);
    const filters = { page: 1, pageSize: 5, q: "dr", clientTypeId: "ct-1" };

    const result = await listPersons(filters);

    expect(findPersons).toHaveBeenCalledWith(filters);
    expect(result).toMatchObject({ total: 1, page: 1, pageSize: 5 });
    expect(result.items[0]).toMatchObject({ code: "PER-00001", centerCount: 1 });
  });
});

describe("setPersonStatus", () => {
  it("flips the status without deleting anything", async () => {
    findPersonReferenceIds.mockResolvedValue({ territoryId: "ter-1" });
    await setPersonStatus("person-1", "INACTIVE", "actor-1");
    expect(setPersonStatusRow).toHaveBeenCalledWith("person-1", "INACTIVE", "actor-1");
  });

  it("throws for a missing Person", async () => {
    findPersonReferenceIds.mockResolvedValue(null);
    await expect(setPersonStatus("nope", "ACTIVE", "a")).rejects.toBeInstanceOf(
      PersonNotFoundError,
    );
  });
});

describe("lookups", () => {
  it("slugifies names accent- and case-insensitively", () => {
    expect(slugifyLookupName("Médecin")).toBe("MEDECIN");
    expect(slugifyLookupName("  médecin  généraliste ")).toBe("MEDECIN_GENERALISTE");
    expect(slugifyLookupName("???")).toBe("");
  });

  it("returns the existing row instead of creating a duplicate", async () => {
    const existing = { id: "pt-1", code: "MEDECIN", name: "MÉDECIN" };
    findLookupByCode.mockResolvedValue(existing);

    const result = await createLookupValue({ kind: "personType", name: "médecin" }, "actor-1");

    expect(result).toBe(existing);
    expect(createLookup).not.toHaveBeenCalled();
  });

  it("creates a new row with a derived code", async () => {
    findLookupByCode.mockResolvedValue(null);
    createLookup.mockResolvedValue({ id: "n-1", code: "SAGE_FEMME", name: "Sage-femme" });

    await createLookupValue({ kind: "personType", name: "Sage-femme" }, "actor-1");

    expect(createLookup).toHaveBeenCalledWith("personType", {
      code: "SAGE_FEMME",
      name: "Sage-femme",
      createdBy: "actor-1",
      updatedBy: "actor-1",
    });
  });

  it("recovers from a creation race by returning the winner's row", async () => {
    const winner = { id: "n-1", code: "X", name: "X" };
    findLookupByCode.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
    createLookup.mockRejectedValue({ code: "P2002" });

    await expect(createLookupValue({ kind: "specialization", name: "X" }, "a")).resolves.toBe(
      winner,
    );
  });

  it("rejects a name with no letters or digits", async () => {
    await expect(
      createLookupValue({ kind: "centerRole", name: "---" }, "a"),
    ).rejects.toBeInstanceOf(InvalidLookupNameError);
  });
});
