import { beforeEach, describe, expect, it, vi } from "vitest";

const findContacts = vi.fn();
const countContacts = vi.fn();
const findContactById = vi.fn();
const findContactCenterLinks = vi.fn();
const findContactReferenceIds = vi.fn();
const createContactWithCenters = vi.fn();
const updateContactWithCenters = vi.fn();
const setContactStatusRow = vi.fn();
const nextContactCodeNumber = vi.fn();
const findContactTypeById = vi.fn();
const findSpecializationById = vi.fn();
const findCentersByIds = vi.fn();
const findCenterRolesByIds = vi.fn();
const findLookupByCode = vi.fn();
const createLookup = vi.fn();

vi.mock("@/server/repositories/contact-repository", () => ({
  findContacts,
  countContacts,
  findContactById,
  findContactCenterLinks,
  findContactReferenceIds,
  createContactWithCenters,
  updateContactWithCenters,
  setContactStatus: setContactStatusRow,
  nextContactCodeNumber,
  findContactTypeById,
  findSpecializationById,
  findCentersByIds,
  findCenterRolesByIds,
  findLookupByCode,
  createLookup,
  listContactTypes: vi.fn(),
  listSpecializations: vi.fn(),
  listCenterRoles: vi.fn(),
}));

vi.mock("@/server/repositories/center-repository", () => ({
  listActiveCentersForSelection: vi.fn(),
  listCenterTypes: vi.fn(),
}));

const findTerritoryById = vi.fn();
vi.mock("@/server/repositories/territory-repository", () => ({ findTerritoryById }));
vi.mock("@/server/services/territory-service", () => ({ listActiveTerritoryOptions: vi.fn() }));

const {
  createContact,
  updateContact,
  listContacts,
  setContactStatus,
  createLookupValue,
  slugifyLookupName,
  formatContactCode,
  DuplicateContactCenterError,
  InactiveContactReferenceError,
  InvalidContactReferenceError,
  InvalidLookupNameError,
  ContactNotFoundError,
} = await import("./contact-service");

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
  id: "contact-1",
  code: "CON-00001",
  name: "Dr Test",
  gender: null,
  mobile: null,
  status: "ACTIVE",
  contactType: { id: "pt-1", code: "MEDECIN", name: "MÉDECIN" },
  specialization: { id: "sp-1", code: "CARDIO", name: "Cardiology" },
  territory: territoryRow,
  centers: [
    {
      center: {
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
  contactTypeId: "pt-1",
  specializationId: "sp-1",
  territoryId: "ter-1",
  centers: [{ centerId: "c-1", roleAtCenterId: "r-1" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  findContactTypeById.mockResolvedValue({ id: "pt-1" });
  findSpecializationById.mockResolvedValue({ id: "sp-1" });
  findTerritoryById.mockResolvedValue(territoryRow);
  findCentersByIds.mockResolvedValue([{ id: "c-1", status: "ACTIVE" }]);
  findCenterRolesByIds.mockResolvedValue([{ id: "r-1" }]);
  nextContactCodeNumber.mockResolvedValue(1);
  createContactWithCenters.mockResolvedValue(detailRow());
  updateContactWithCenters.mockResolvedValue(detailRow());
});

describe("formatContactCode", () => {
  it("pads the sequence number", () => {
    expect(formatContactCode(7)).toBe("CON-00007");
    expect(formatContactCode(12345)).toBe("CON-12345");
  });
});

describe("createContact", () => {
  it("generates the code on the backend and returns the Territory path", async () => {
    nextContactCodeNumber.mockResolvedValue(42);
    createContactWithCenters.mockResolvedValue(detailRow({ code: "CON-00042" }));

    const result = await createContact(baseInput, "actor-1");

    expect(createContactWithCenters).toHaveBeenCalledWith(
      expect.objectContaining({ code: "CON-00042", name: "Dr Test" }),
      baseInput.centers,
      "actor-1",
    );
    expect(result.code).toBe("CON-00042");
    expect(result.territory.label).toBe("Province A › Ville B");
    expect(result.centers[0]).toMatchObject({ roleName: "Doctor", typeName: "Hospital" });
  });

  it("retries with the next sequence value when the code collides", async () => {
    nextContactCodeNumber.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    createContactWithCenters
      .mockRejectedValueOnce({ code: "P2002", meta: { target: ["code"] } })
      .mockResolvedValueOnce(detailRow({ code: "CON-00002" }));

    const result = await createContact(baseInput, "actor-1");

    expect(createContactWithCenters).toHaveBeenCalledTimes(2);
    expect(result.code).toBe("CON-00002");
  });

  it("rejects the same Center twice", async () => {
    await expect(
      createContact(
        {
          ...baseInput,
          centers: [
            { centerId: "c-1", roleAtCenterId: "r-1" },
            { centerId: "c-1", roleAtCenterId: "r-2" },
          ],
        },
        "actor-1",
      ),
    ).rejects.toBeInstanceOf(DuplicateContactCenterError);
    expect(createContactWithCenters).not.toHaveBeenCalled();
  });

  it("allows one Contact at several Centers with a different role each", async () => {
    findCentersByIds.mockResolvedValue([
      { id: "c-1", status: "ACTIVE" },
      { id: "c-2", status: "ACTIVE" },
    ]);
    findCenterRolesByIds.mockResolvedValue([{ id: "r-1" }, { id: "r-2" }]);
    const centers = [
      { centerId: "c-1", roleAtCenterId: "r-1" },
      { centerId: "c-2", roleAtCenterId: "r-2" },
    ];

    await createContact({ ...baseInput, centers }, "actor-1");

    expect(createContactWithCenters).toHaveBeenCalledWith(expect.anything(), centers, "actor-1");
  });

  it("rejects an inactive Territory", async () => {
    findTerritoryById.mockResolvedValue({ ...territoryRow, status: "INACTIVE" });
    await expect(createContact(baseInput, "a")).rejects.toBeInstanceOf(
      InactiveContactReferenceError,
    );
  });

  it("rejects an inactive Center", async () => {
    findCentersByIds.mockResolvedValue([{ id: "c-1", status: "INACTIVE" }]);
    await expect(createContact(baseInput, "a")).rejects.toBeInstanceOf(
      InactiveContactReferenceError,
    );
  });

  it("rejects unknown references", async () => {
    findContactTypeById.mockResolvedValue(null);
    await expect(createContact(baseInput, "a")).rejects.toBeInstanceOf(
      InvalidContactReferenceError,
    );

    findContactTypeById.mockResolvedValue({ id: "pt-1" });
    findSpecializationById.mockResolvedValue(null);
    await expect(createContact(baseInput, "a")).rejects.toBeInstanceOf(
      InvalidContactReferenceError,
    );

    findSpecializationById.mockResolvedValue({ id: "sp-1" });
    findTerritoryById.mockResolvedValue(null);
    await expect(createContact(baseInput, "a")).rejects.toBeInstanceOf(
      InvalidContactReferenceError,
    );

    findTerritoryById.mockResolvedValue(territoryRow);
    findCentersByIds.mockResolvedValue([]);
    await expect(createContact(baseInput, "a")).rejects.toBeInstanceOf(
      InvalidContactReferenceError,
    );

    findCentersByIds.mockResolvedValue([{ id: "c-1", status: "ACTIVE" }]);
    findCenterRolesByIds.mockResolvedValue([]);
    await expect(createContact(baseInput, "a")).rejects.toBeInstanceOf(
      InvalidContactReferenceError,
    );
  });
});

describe("updateContact", () => {
  const updateInput = { ...baseInput, id: "contact-1" };

  beforeEach(() => {
    findContactReferenceIds.mockResolvedValue({
      contactTypeId: "pt-1",
      specializationId: "sp-1",
      territoryId: "ter-1",
    });
    findContactCenterLinks.mockResolvedValue([{ centerId: "c-1", roleAtCenterId: "r-1" }]);
  });

  it("never sends a code, so it stays immutable", async () => {
    await updateContact(updateInput, "actor-1");

    const data = updateContactWithCenters.mock.calls[0]![1];
    expect(data).not.toHaveProperty("code");
    expect(nextContactCodeNumber).not.toHaveBeenCalled();
  });

  it("passes the replaced association set, including changed roles", async () => {
    findCenterRolesByIds.mockResolvedValue([{ id: "r-9" }]);
    const centers = [{ centerId: "c-1", roleAtCenterId: "r-9" }];

    await updateContact({ ...updateInput, centers }, "actor-1");

    expect(updateContactWithCenters).toHaveBeenCalledWith(
      "contact-1",
      expect.anything(),
      centers,
      "actor-1",
    );
  });

  it("does not block saving when an untouched existing Center was later deactivated", async () => {
    findCentersByIds.mockResolvedValue([{ id: "c-1", status: "INACTIVE" }]);
    await expect(updateContact(updateInput, "actor-1")).resolves.toBeDefined();
  });

  it("rejects a newly added inactive Center", async () => {
    findCentersByIds.mockResolvedValue([
      { id: "c-1", status: "ACTIVE" },
      { id: "c-2", status: "INACTIVE" },
    ]);
    findCenterRolesByIds.mockResolvedValue([{ id: "r-1" }]);
    await expect(
      updateContact(
        {
          ...updateInput,
          centers: [
            { centerId: "c-1", roleAtCenterId: "r-1" },
            { centerId: "c-2", roleAtCenterId: "r-1" },
          ],
        },
        "actor-1",
      ),
    ).rejects.toBeInstanceOf(InactiveContactReferenceError);
  });

  it("allows keeping an inactive current Territory but rejects switching to one", async () => {
    findTerritoryById.mockResolvedValue({ ...territoryRow, status: "INACTIVE" });
    await expect(updateContact(updateInput, "actor-1")).resolves.toBeDefined();

    findContactReferenceIds.mockResolvedValue({
      contactTypeId: "pt-1",
      specializationId: "sp-1",
      territoryId: "other-territory",
    });
    await expect(updateContact(updateInput, "actor-1")).rejects.toBeInstanceOf(
      InactiveContactReferenceError,
    );
  });

  it("throws for a missing Contact", async () => {
    findContactReferenceIds.mockResolvedValue(null);
    await expect(updateContact(updateInput, "actor-1")).rejects.toBeInstanceOf(
      ContactNotFoundError,
    );
  });
});

describe("listContacts", () => {
  it("is organisation-wide: filters go straight to the query with no user scope", async () => {
    findContacts.mockResolvedValue([detailRow()]);
    countContacts.mockResolvedValue(1);
    const filters = { page: 1, pageSize: 5, q: "dr", centerTypeId: "ct-1" };

    const result = await listContacts(filters);

    expect(findContacts).toHaveBeenCalledWith(filters);
    expect(result).toMatchObject({ total: 1, page: 1, pageSize: 5 });
    expect(result.items[0]).toMatchObject({ code: "CON-00001", centerCount: 1 });
  });
});

describe("setContactStatus", () => {
  it("flips the status without deleting anything", async () => {
    findContactReferenceIds.mockResolvedValue({ territoryId: "ter-1" });
    await setContactStatus("contact-1", "INACTIVE", "actor-1");
    expect(setContactStatusRow).toHaveBeenCalledWith("contact-1", "INACTIVE", "actor-1");
  });

  it("throws for a missing Contact", async () => {
    findContactReferenceIds.mockResolvedValue(null);
    await expect(setContactStatus("nope", "ACTIVE", "a")).rejects.toBeInstanceOf(
      ContactNotFoundError,
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

    const result = await createLookupValue({ kind: "contactType", name: "médecin" }, "actor-1");

    expect(result).toBe(existing);
    expect(createLookup).not.toHaveBeenCalled();
  });

  it("creates a new row with a derived code", async () => {
    findLookupByCode.mockResolvedValue(null);
    createLookup.mockResolvedValue({ id: "n-1", code: "SAGE_FEMME", name: "Sage-femme" });

    await createLookupValue({ kind: "contactType", name: "Sage-femme" }, "actor-1");

    expect(createLookup).toHaveBeenCalledWith("contactType", {
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
