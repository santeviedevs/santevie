import { beforeEach, describe, expect, it, vi } from "vitest";

const createCenterWithExtension = vi.fn();
const updateCenterWithExtension = vi.fn();
const findCenterById = vi.fn();
const findCenters = vi.fn();
const listActiveCentersForSelection = vi.fn();
const listCenterTypes = vi.fn();

vi.mock("@/server/repositories/center-repository", () => ({
  createCenterWithExtension,
  updateCenterWithExtension,
  findCenterById,
  findCenters,
  listActiveCentersForSelection,
  listCenterTypes,
}));

const findTerritoryById = vi.fn();
vi.mock("@/server/repositories/territory-repository", () => ({ findTerritoryById }));

const listActiveTerritoryOptions = vi.fn();
vi.mock("@/server/services/territory-service", () => ({ listActiveTerritoryOptions }));

const {
  createCenter,
  updateCenter,
  DuplicateCenterCodeError,
  InactiveTerritoryError,
  CenterTypeMismatchError,
} = await import("./center-service");

const CLINIC_TYPE = { id: "type-clinic", code: "CLINIC", name: "Clinic" };
const HOSPITAL_TYPE = { id: "type-hospital", code: "HOSPITAL", name: "Hospital" };
const CHEMIST_TYPE = { id: "type-chemist", code: "CHEMIST", name: "Chemist" };

const baseCenterRow = (overrides: Record<string, unknown> = {}) => ({
  id: "center-1",
  code: "CL-0001",
  name: "Sample",
  contact: null,
  address: null,
  latitude: null,
  longitude: null,
  status: "ACTIVE",
  type: CHEMIST_TYPE,
  territory: null,
  hospital: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  listCenterTypes.mockResolvedValue([CLINIC_TYPE, HOSPITAL_TYPE, CHEMIST_TYPE]);
  findTerritoryById.mockResolvedValue({ id: "territory-1", status: "ACTIVE" });
  createCenterWithExtension.mockResolvedValue(baseCenterRow());
  updateCenterWithExtension.mockResolvedValue(baseCenterRow());
});

describe("createCenter", () => {
  it("creates a Chemist center with no extension", async () => {
    const result = await createCenter(
      { code: "CL-0001", name: "Sample", typeId: CHEMIST_TYPE.id },
      "actor-1",
    );
    expect(result.code).toBe("CL-0001");
    expect(createCenterWithExtension).toHaveBeenCalledWith(
      expect.objectContaining({ hospital: undefined }),
    );
  });

  it("rejects an inactive territory", async () => {
    findTerritoryById.mockResolvedValue({ id: "territory-1", status: "INACTIVE" });
    await expect(
      createCenter(
        { code: "CL-0001", name: "Sample", typeId: CHEMIST_TYPE.id, territoryId: "territory-1" },
        "actor-1",
      ),
    ).rejects.toThrow(InactiveTerritoryError);
  });

  it("creates a Clinic center with no extension", async () => {
    await createCenter({ code: "CL-0002", name: "Clinic", typeId: CLINIC_TYPE.id }, "actor-1");
    expect(createCenterWithExtension).toHaveBeenCalledWith(
      expect.objectContaining({ hospital: undefined }),
    );
  });

  it("rejects a Hospital type submitted without hospital details", async () => {
    await expect(
      createCenter({ code: "CL-0003", name: "Hosp", typeId: HOSPITAL_TYPE.id }, "actor-1"),
    ).rejects.toThrow(CenterTypeMismatchError);
  });

  it("rejects hospital details submitted under a non-Hospital type", async () => {
    await expect(
      createCenter(
        {
          code: "CL-0003",
          name: "Clinic",
          typeId: CLINIC_TYPE.id,
          hospital: { hospitalCategory: "Centre Médical" },
        },
        "actor-1",
      ),
    ).rejects.toThrow(CenterTypeMismatchError);
  });

  it("maps a unique constraint violation to DuplicateCenterCodeError", async () => {
    createCenterWithExtension.mockRejectedValue({ code: "P2002" });
    await expect(
      createCenter({ code: "CL-0001", name: "Sample", typeId: CHEMIST_TYPE.id }, "actor-1"),
    ).rejects.toThrow(DuplicateCenterCodeError);
  });
});

describe("updateCenter", () => {
  it("updates a center and reports missing coordinates", async () => {
    updateCenterWithExtension.mockResolvedValue(baseCenterRow({ latitude: null, longitude: null }));
    const result = await updateCenter(
      { id: "center-1", code: "CL-0001", name: "Sample", typeId: CHEMIST_TYPE.id },
      "actor-1",
    );
    expect(result.hasCoordinates).toBe(false);
  });

  it("reports coordinates present when both are set", async () => {
    updateCenterWithExtension.mockResolvedValue(baseCenterRow({ latitude: 1.5, longitude: 2.5 }));
    const result = await updateCenter(
      { id: "center-1", code: "CL-0001", name: "Sample", typeId: CHEMIST_TYPE.id },
      "actor-1",
    );
    expect(result.hasCoordinates).toBe(true);
  });
});
