import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientWithExtension = vi.fn();
const updateClientWithExtension = vi.fn();
const findClientById = vi.fn();
const findClients = vi.fn();
const listActiveClientsForSelection = vi.fn();
const listClientTypes = vi.fn();

vi.mock("@/server/repositories/client-repository", () => ({
  createClientWithExtension,
  updateClientWithExtension,
  findClientById,
  findClients,
  listActiveClientsForSelection,
  listClientTypes,
}));

const setDoctorHospitals = vi.fn();
vi.mock("@/server/repositories/doctor-hospital-repository", () => ({ setDoctorHospitals }));

const findProvinceById = vi.fn();
const findVilleById = vi.fn();
const findCommuneById = vi.fn();
const findQuartierById = vi.fn();
const listActiveProvinces = vi.fn();
const listActiveVilles = vi.fn();
const listActiveCommunes = vi.fn();
const listActiveQuartiers = vi.fn();

vi.mock("@/server/repositories/territory-repository", () => ({
  findProvinceById,
  findVilleById,
  findCommuneById,
  findQuartierById,
  listActiveProvinces,
  listActiveVilles,
  listActiveCommunes,
  listActiveQuartiers,
}));

const {
  createClient,
  updateClient,
  DuplicateClientCodeError,
  InactiveTerritoryError,
  ClientTypeMismatchError,
} = await import("./client-service");

const DOCTOR_TYPE = { id: "type-doctor", code: "DOCTOR", name: "Doctor" };
const HOSPITAL_TYPE = { id: "type-hospital", code: "HOSPITAL", name: "Hospital" };
const CHEMIST_TYPE = { id: "type-chemist", code: "CHEMIST", name: "Chemist" };

const baseClientRow = (overrides: Record<string, unknown> = {}) => ({
  id: "client-1",
  code: "CL-0001",
  name: "Sample",
  contact: null,
  address: null,
  latitude: null,
  longitude: null,
  status: "ACTIVE",
  type: CHEMIST_TYPE,
  province: null,
  ville: null,
  commune: null,
  quartier: null,
  doctor: null,
  hospital: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  listClientTypes.mockResolvedValue([DOCTOR_TYPE, HOSPITAL_TYPE, CHEMIST_TYPE]);
  findProvinceById.mockResolvedValue({ id: "province-1", status: "ACTIVE" });
  findVilleById.mockResolvedValue({ id: "ville-1", provinceId: "province-1", status: "ACTIVE" });
  findCommuneById.mockResolvedValue({ id: "commune-1", villeId: "ville-1", status: "ACTIVE" });
  findQuartierById.mockResolvedValue({ id: "quartier-1", status: "ACTIVE" });
  createClientWithExtension.mockResolvedValue(baseClientRow());
  updateClientWithExtension.mockResolvedValue(baseClientRow());
});

describe("createClient", () => {
  it("creates a Chemist client with no extension", async () => {
    const result = await createClient(
      { code: "CL-0001", name: "Sample", typeId: CHEMIST_TYPE.id },
      "actor-1",
    );
    expect(result.code).toBe("CL-0001");
    expect(createClientWithExtension).toHaveBeenCalledWith(
      expect.objectContaining({ doctor: undefined, hospital: undefined }),
    );
  });

  it("rejects an inactive quartier", async () => {
    findQuartierById.mockResolvedValue({ id: "quartier-1", status: "INACTIVE" });
    await expect(
      createClient(
        { code: "CL-0001", name: "Sample", typeId: CHEMIST_TYPE.id, quartierId: "quartier-1" },
        "actor-1",
      ),
    ).rejects.toThrow(InactiveTerritoryError);
  });

  it("rejects a Doctor type submitted without doctor details", async () => {
    await expect(
      createClient({ code: "CL-0002", name: "Doc", typeId: DOCTOR_TYPE.id }, "actor-1"),
    ).rejects.toThrow(ClientTypeMismatchError);
  });

  it("rejects doctor details submitted under a non-Doctor type", async () => {
    await expect(
      createClient(
        {
          code: "CL-0002",
          name: "Doc",
          typeId: CHEMIST_TYPE.id,
          doctor: { doctorType: "MÉDECIN" },
        },
        "actor-1",
      ),
    ).rejects.toThrow(ClientTypeMismatchError);
  });

  it("creates a Doctor client and sets its hospital links", async () => {
    createClientWithExtension.mockResolvedValue(
      baseClientRow({ type: DOCTOR_TYPE, doctor: { id: "doctor-1", hospitals: [] } }),
    );
    findClientById.mockResolvedValue(
      baseClientRow({ type: DOCTOR_TYPE, doctor: { id: "doctor-1", hospitals: [] } }),
    );

    await createClient(
      {
        code: "CL-0002",
        name: "Doc",
        typeId: DOCTOR_TYPE.id,
        doctor: { doctorType: "MÉDECIN" },
        hospitalIds: ["hospital-1", "hospital-2"],
      },
      "actor-1",
    );

    expect(setDoctorHospitals).toHaveBeenCalledWith(
      "doctor-1",
      ["hospital-1", "hospital-2"],
      "actor-1",
    );
  });

  it("maps a unique constraint violation to DuplicateClientCodeError", async () => {
    createClientWithExtension.mockRejectedValue({ code: "P2002" });
    await expect(
      createClient({ code: "CL-0001", name: "Sample", typeId: CHEMIST_TYPE.id }, "actor-1"),
    ).rejects.toThrow(DuplicateClientCodeError);
  });
});

describe("updateClient", () => {
  it("updates a client and reports missing coordinates", async () => {
    updateClientWithExtension.mockResolvedValue(baseClientRow({ latitude: null, longitude: null }));
    const result = await updateClient(
      { id: "client-1", code: "CL-0001", name: "Sample", typeId: CHEMIST_TYPE.id },
      "actor-1",
    );
    expect(result.hasCoordinates).toBe(false);
  });

  it("reports coordinates present when both are set", async () => {
    updateClientWithExtension.mockResolvedValue(baseClientRow({ latitude: 1.5, longitude: 2.5 }));
    const result = await updateClient(
      { id: "client-1", code: "CL-0001", name: "Sample", typeId: CHEMIST_TYPE.id },
      "actor-1",
    );
    expect(result.hasCoordinates).toBe(true);
  });
});
