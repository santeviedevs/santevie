import type { ClientFilters, CreateClientInput, UpdateClientInput } from "@/lib/schemas/client";
import {
  type ClientWithRelations,
  createClientWithExtension,
  findClientById,
  findClients,
  listActiveClientsForSelection as listActiveClientsForSelectionRow,
  listClientTypes,
  updateClientWithExtension,
} from "@/server/repositories/client-repository";
import { setDoctorHospitals } from "@/server/repositories/doctor-hospital-repository";
import {
  findCommuneById,
  findProvinceById,
  findQuartierById,
  findVilleById,
  listActiveCommunes,
  listActiveProvinces,
  listActiveQuartiers,
  listActiveVilles,
} from "@/server/repositories/territory-repository";

export class DuplicateClientCodeError extends Error {
  constructor() {
    super("A client with this code already exists.");
    this.name = "DuplicateClientCodeError";
  }
}

// Mirrors territory-service.ts's InactiveParentError: a Client can never be
// assigned to a Province/Ville/Commune/Quartier that is itself inactive
// (S2-02: "validate ... that the territory is active").
export class InactiveTerritoryError extends Error {
  constructor() {
    super("The selected territory is not active.");
    this.name = "InactiveTerritoryError";
  }
}

// A request claiming `doctor` fields under a Client type whose code isn't
// DOCTOR (or `hospital` fields under a type that isn't HOSPITAL) — never
// trusted just because the form's discriminant said so.
export class ClientTypeMismatchError extends Error {
  constructor() {
    super("The submitted details do not match the selected client type.");
    this.name = "ClientTypeMismatchError";
  }
}

function isUniqueConstraintViolation(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

function mapUniqueConstraintError(error: unknown): never {
  if (isUniqueConstraintViolation(error)) {
    throw new DuplicateClientCodeError();
  }
  throw error;
}

async function assertTerritoryActive(input: {
  provinceId?: string | null;
  villeId?: string | null;
  communeId?: string | null;
  quartierId?: string | null;
}): Promise<void> {
  if (input.provinceId) {
    const province = await findProvinceById(input.provinceId);
    if (!province || province.status === "INACTIVE") throw new InactiveTerritoryError();
  }
  if (input.villeId) {
    const ville = await findVilleById(input.villeId);
    if (!ville || ville.status === "INACTIVE") throw new InactiveTerritoryError();
  }
  if (input.communeId) {
    const commune = await findCommuneById(input.communeId);
    if (!commune || commune.status === "INACTIVE") throw new InactiveTerritoryError();
  }
  if (input.quartierId) {
    const quartier = await findQuartierById(input.quartierId);
    if (!quartier || quartier.status === "INACTIVE") throw new InactiveTerritoryError();
  }
}

export type ClientSummary = {
  id: string;
  code: string;
  name: string;
  contact: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: "ACTIVE" | "INACTIVE";
  hasCoordinates: boolean;
  type: { id: string; code: string; name: string };
  province: { id: string; name: string } | null;
  ville: { id: string; name: string } | null;
  commune: { id: string; name: string } | null;
  quartier: { id: string; name: string } | null;
  doctor: {
    id: string;
    doctorType: string | null;
    gender: string | null;
    department: string | null;
    mobileNo: string | null;
    hospitals: { id: string; name: string; code: string }[];
  } | null;
  hospital: { id: string; hospitalCategory: string | null } | null;
};

function toSummary(client: ClientWithRelations): ClientSummary {
  const latitude = client.latitude === null ? null : Number(client.latitude);
  const longitude = client.longitude === null ? null : Number(client.longitude);
  return {
    id: client.id,
    code: client.code,
    name: client.name,
    contact: client.contact,
    address: client.address,
    latitude,
    longitude,
    status: client.status,
    hasCoordinates: latitude !== null && longitude !== null,
    type: { id: client.type.id, code: client.type.code, name: client.type.name },
    province: client.province,
    ville: client.ville,
    commune: client.commune,
    quartier: client.quartier,
    doctor: client.doctor
      ? {
          id: client.doctor.id,
          doctorType: client.doctor.doctorType,
          gender: client.doctor.gender,
          department: client.doctor.department,
          mobileNo: client.doctor.mobileNo,
          hospitals: client.doctor.hospitals.map((link) => ({
            id: link.hospital.id,
            name: link.hospital.client.name,
            code: link.hospital.client.code,
          })),
        }
      : null,
    hospital: client.hospital
      ? { id: client.hospital.id, hospitalCategory: client.hospital.hospitalCategory }
      : null,
  };
}

export async function listClients(filters: ClientFilters): Promise<ClientSummary[]> {
  const clients = await findClients(filters);
  return clients.map(toSummary);
}

export async function getClient(id: string): Promise<ClientSummary | null> {
  const client = await findClientById(id);
  return client ? toSummary(client) : null;
}

export async function listActiveClientsForSelection() {
  return listActiveClientsForSelectionRow();
}

export async function getClientFormOptions() {
  const [types, provinces, villes, communes, quartiers] = await Promise.all([
    listClientTypes(),
    listActiveProvinces(),
    listActiveVilles(),
    listActiveCommunes(),
    listActiveQuartiers(),
  ]);
  return { types, provinces, villes, communes, quartiers };
}

// Confirms the requested extension matches the selected ClientType's code —
// never trusts the shape of the submitted input alone (a form could claim
// `doctor` fields while `typeId` actually resolves to HOSPITAL).
async function resolveTypeCode(typeId: string): Promise<string> {
  const types = await listClientTypes();
  const type = types.find((t) => t.id === typeId);
  if (!type) throw new ClientTypeMismatchError();
  return type.code;
}

function assertExtensionMatchesType(
  typeCode: string,
  input: Pick<CreateClientInput, "doctor" | "hospital">,
): void {
  if (typeCode === "DOCTOR" && !input.doctor) throw new ClientTypeMismatchError();
  if (typeCode === "HOSPITAL" && !input.hospital) throw new ClientTypeMismatchError();
  if (typeCode !== "DOCTOR" && input.doctor) throw new ClientTypeMismatchError();
  if (typeCode !== "HOSPITAL" && input.hospital) throw new ClientTypeMismatchError();
}

export async function createClient(
  input: CreateClientInput,
  actorId: string,
): Promise<ClientSummary> {
  await assertTerritoryActive(input);
  const typeCode = await resolveTypeCode(input.typeId);
  assertExtensionMatchesType(typeCode, input);

  let created: ClientWithRelations;
  try {
    created = await createClientWithExtension({
      client: {
        code: input.code,
        name: input.name,
        contact: input.contact ?? null,
        address: input.address ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        status: "ACTIVE",
        type: { connect: { id: input.typeId } },
        province: input.provinceId ? { connect: { id: input.provinceId } } : undefined,
        ville: input.villeId ? { connect: { id: input.villeId } } : undefined,
        commune: input.communeId ? { connect: { id: input.communeId } } : undefined,
        quartier: input.quartierId ? { connect: { id: input.quartierId } } : undefined,
        createdBy: actorId,
        updatedBy: actorId,
      },
      doctor: input.doctor
        ? {
            doctorType: input.doctor.doctorType ?? null,
            gender: input.doctor.gender ?? null,
            department: input.doctor.department ?? null,
            mobileNo: input.doctor.mobileNo ?? null,
            createdBy: actorId,
            updatedBy: actorId,
          }
        : undefined,
      hospital: input.hospital
        ? {
            hospitalCategory: input.hospital.hospitalCategory ?? null,
            createdBy: actorId,
            updatedBy: actorId,
          }
        : undefined,
    });
  } catch (error) {
    mapUniqueConstraintError(error);
  }

  if (typeCode === "DOCTOR" && created.doctor && input.hospitalIds) {
    await setDoctorHospitals(created.doctor.id, input.hospitalIds, actorId);
    created = (await findClientById(created.id))!;
  }

  return toSummary(created);
}

export async function updateClient(
  input: UpdateClientInput,
  actorId: string,
): Promise<ClientSummary> {
  await assertTerritoryActive(input);
  const typeCode = await resolveTypeCode(input.typeId);
  assertExtensionMatchesType(typeCode, input);

  let updated: ClientWithRelations;
  try {
    updated = await updateClientWithExtension(input.id, {
      client: {
        code: input.code,
        name: input.name,
        contact: input.contact ?? null,
        address: input.address ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        type: { connect: { id: input.typeId } },
        province: input.provinceId ? { connect: { id: input.provinceId } } : { disconnect: true },
        ville: input.villeId ? { connect: { id: input.villeId } } : { disconnect: true },
        commune: input.communeId ? { connect: { id: input.communeId } } : { disconnect: true },
        quartier: input.quartierId ? { connect: { id: input.quartierId } } : { disconnect: true },
        ...(input.status ? { status: input.status } : {}),
        updatedBy: actorId,
      },
      doctor: input.doctor
        ? {
            doctorType: input.doctor.doctorType ?? null,
            gender: input.doctor.gender ?? null,
            department: input.doctor.department ?? null,
            mobileNo: input.doctor.mobileNo ?? null,
            updatedBy: actorId,
          }
        : undefined,
      hospital: input.hospital
        ? { hospitalCategory: input.hospital.hospitalCategory ?? null, updatedBy: actorId }
        : undefined,
    });
  } catch (error) {
    mapUniqueConstraintError(error);
  }

  if (typeCode === "DOCTOR" && updated.doctor && input.hospitalIds) {
    await setDoctorHospitals(updated.doctor.id, input.hospitalIds, actorId);
    updated = (await findClientById(updated.id))!;
  }

  return toSummary(updated);
}
