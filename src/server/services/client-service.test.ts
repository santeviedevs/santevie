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

const findTerritoryById = vi.fn();
vi.mock("@/server/repositories/territory-repository", () => ({ findTerritoryById }));

const listActiveTerritoryOptions = vi.fn();
vi.mock("@/server/services/territory-service", () => ({ listActiveTerritoryOptions }));

const {
  createClient,
  updateClient,
  DuplicateClientCodeError,
  InactiveTerritoryError,
  ClientTypeMismatchError,
} = await import("./client-service");

const CLINIC_TYPE = { id: "type-clinic", code: "CLINIC", name: "Clinic" };
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
  territory: null,
  hospital: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  listClientTypes.mockResolvedValue([CLINIC_TYPE, HOSPITAL_TYPE, CHEMIST_TYPE]);
  findTerritoryById.mockResolvedValue({ id: "territory-1", status: "ACTIVE" });
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
      expect.objectContaining({ hospital: undefined }),
    );
  });

  it("rejects an inactive territory", async () => {
    findTerritoryById.mockResolvedValue({ id: "territory-1", status: "INACTIVE" });
    await expect(
      createClient(
        { code: "CL-0001", name: "Sample", typeId: CHEMIST_TYPE.id, territoryId: "territory-1" },
        "actor-1",
      ),
    ).rejects.toThrow(InactiveTerritoryError);
  });

  it("creates a Clinic client with no extension", async () => {
    await createClient({ code: "CL-0002", name: "Clinic", typeId: CLINIC_TYPE.id }, "actor-1");
    expect(createClientWithExtension).toHaveBeenCalledWith(
      expect.objectContaining({ hospital: undefined }),
    );
  });

  it("rejects a Hospital type submitted without hospital details", async () => {
    await expect(
      createClient({ code: "CL-0003", name: "Hosp", typeId: HOSPITAL_TYPE.id }, "actor-1"),
    ).rejects.toThrow(ClientTypeMismatchError);
  });

  it("rejects hospital details submitted under a non-Hospital type", async () => {
    await expect(
      createClient(
        {
          code: "CL-0003",
          name: "Clinic",
          typeId: CLINIC_TYPE.id,
          hospital: { hospitalCategory: "Centre Médical" },
        },
        "actor-1",
      ),
    ).rejects.toThrow(ClientTypeMismatchError);
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
