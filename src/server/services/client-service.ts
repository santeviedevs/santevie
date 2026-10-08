import type { PagedResult } from "@/lib/pagination";
import type { ClientFilters, CreateClientInput, UpdateClientInput } from "@/lib/schemas/client";
import {
  type ClientWithRelations,
  countClients,
  createClientWithExtension,
  findClientById,
  findClients,
  listActiveClientsForSelection as listActiveClientsForSelectionRow,
  listClientTypes,
  updateClientWithExtension,
} from "@/server/repositories/client-repository";
import { findTerritoryById } from "@/server/repositories/territory-repository";
import { listActiveTerritoryOptions } from "@/server/services/territory-service";

export class DuplicateClientCodeError extends Error {
  constructor() {
    super("A client with this code already exists.");
    this.name = "DuplicateClientCodeError";
  }
}

// A Client can never be assigned to a Territory that is itself inactive
// (S2-02: "validate ... that the territory is active").
export class InactiveTerritoryError extends Error {
  constructor() {
    super("The selected territory is not active.");
    this.name = "InactiveTerritoryError";
  }
}

// A request claiming `hospital` fields under a type that isn't HOSPITAL —
// never trusted just because the form's discriminant said so.
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

async function assertTerritoryActive(territoryId: string | null | undefined): Promise<void> {
  if (!territoryId) return;
  const territory = await findTerritoryById(territoryId);
  if (!territory || territory.status === "INACTIVE") throw new InactiveTerritoryError();
}

export type ClientSummary = {
  id: string;
  code: string;
  name: string;
  responsiblePerson: string | null;
  contact: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: "ACTIVE" | "INACTIVE";
  hasCoordinates: boolean;
  type: { id: string; code: string; name: string };
  territory: {
    id: string;
    code: string;
    province: { id: string; name: string };
    ville: { id: string; name: string } | null;
    commune: { id: string; name: string } | null;
    quartier: { id: string; name: string } | null;
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
    responsiblePerson: client.responsiblePerson,
    contact: client.contact,
    address: client.address,
    latitude,
    longitude,
    status: client.status,
    hasCoordinates: latitude !== null && longitude !== null,
    type: { id: client.type.id, code: client.type.code, name: client.type.name },
    territory: client.territory,
    hospital: client.hospital
      ? { id: client.hospital.id, hospitalCategory: client.hospital.hospitalCategory }
      : null,
  };
}

export async function listClients(filters: ClientFilters): Promise<PagedResult<ClientSummary>> {
  const [clients, total] = await Promise.all([findClients(filters), countClients(filters)]);
  return { items: clients.map(toSummary), total, page: filters.page, pageSize: filters.pageSize };
}

export async function getClient(id: string): Promise<ClientSummary | null> {
  const client = await findClientById(id);
  return client ? toSummary(client) : null;
}

export async function listActiveClientsForSelection() {
  return listActiveClientsForSelectionRow();
}

export async function getClientFormOptions() {
  const [types, territories] = await Promise.all([listClientTypes(), listActiveTerritoryOptions()]);
  return { types, territories };
}

// Confirms the requested extension matches the selected ClientType's code —
// never trusts the shape of the submitted input alone (a form could claim
// `hospital` fields while `typeId` actually resolves to CHEMIST).
async function resolveTypeCode(typeId: string): Promise<string> {
  const types = await listClientTypes();
  const type = types.find((t) => t.id === typeId);
  if (!type) throw new ClientTypeMismatchError();
  return type.code;
}

function assertExtensionMatchesType(
  typeCode: string,
  input: Pick<CreateClientInput, "hospital">,
): void {
  if (typeCode === "HOSPITAL" && !input.hospital) throw new ClientTypeMismatchError();
  if (typeCode !== "HOSPITAL" && input.hospital) throw new ClientTypeMismatchError();
}

export async function createClient(
  input: CreateClientInput,
  actorId: string,
): Promise<ClientSummary> {
  await assertTerritoryActive(input.territoryId);
  const typeCode = await resolveTypeCode(input.typeId);
  assertExtensionMatchesType(typeCode, input);

  let created: ClientWithRelations;
  try {
    created = await createClientWithExtension({
      client: {
        code: input.code,
        name: input.name,
        responsiblePerson: input.responsiblePerson ?? null,
        contact: input.contact ?? null,
        address: input.address ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        status: "ACTIVE",
        type: { connect: { id: input.typeId } },
        territory: input.territoryId ? { connect: { id: input.territoryId } } : undefined,
        createdBy: actorId,
        updatedBy: actorId,
      },
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

  return toSummary(created);
}

export async function updateClient(
  input: UpdateClientInput,
  actorId: string,
): Promise<ClientSummary> {
  await assertTerritoryActive(input.territoryId);
  const typeCode = await resolveTypeCode(input.typeId);
  assertExtensionMatchesType(typeCode, input);

  let updated: ClientWithRelations;
  try {
    updated = await updateClientWithExtension(input.id, {
      client: {
        code: input.code,
        name: input.name,
        responsiblePerson: input.responsiblePerson ?? null,
        contact: input.contact ?? null,
        address: input.address ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        type: { connect: { id: input.typeId } },
        territory: input.territoryId
          ? { connect: { id: input.territoryId } }
          : { disconnect: true },
        ...(input.status ? { status: input.status } : {}),
        updatedBy: actorId,
      },
      hospital: input.hospital
        ? { hospitalCategory: input.hospital.hospitalCategory ?? null, updatedBy: actorId }
        : undefined,
    });
  } catch (error) {
    mapUniqueConstraintError(error);
  }

  return toSummary(updated);
}
