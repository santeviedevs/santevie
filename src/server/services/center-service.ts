import type { PagedResult } from "@/lib/pagination";
import type { CenterFilters, CreateCenterInput, UpdateCenterInput } from "@/lib/schemas/center";
import {
  type CenterWithRelations,
  countCenters,
  createCenterWithExtension,
  findCenterById,
  findCenters,
  listActiveCentersForSelection as listActiveCentersForSelectionRow,
  listCenterTypes,
  updateCenterWithExtension,
} from "@/server/repositories/center-repository";
import { findTerritoryById } from "@/server/repositories/territory-repository";
import { listActiveTerritoryOptions } from "@/server/services/territory-service";

export class DuplicateCenterCodeError extends Error {
  constructor() {
    super("A center with this code already exists.");
    this.name = "DuplicateCenterCodeError";
  }
}

// A Center can never be assigned to a Territory that is itself inactive
// (S2-02: "validate ... that the territory is active").
export class InactiveTerritoryError extends Error {
  constructor() {
    super("The selected territory is not active.");
    this.name = "InactiveTerritoryError";
  }
}

// A request claiming `hospital` fields under a type that isn't HOSPITAL —
// never trusted just because the form's discriminant said so.
export class CenterTypeMismatchError extends Error {
  constructor() {
    super("The submitted details do not match the selected center type.");
    this.name = "CenterTypeMismatchError";
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
    throw new DuplicateCenterCodeError();
  }
  throw error;
}

async function assertTerritoryActive(territoryId: string | null | undefined): Promise<void> {
  if (!territoryId) return;
  const territory = await findTerritoryById(territoryId);
  if (!territory || territory.status === "INACTIVE") throw new InactiveTerritoryError();
}

export type CenterSummary = {
  id: string;
  code: string;
  name: string;
  responsiblePerson: string | null;
  mobileNo: string | null;
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

function toSummary(center: CenterWithRelations): CenterSummary {
  const latitude = center.latitude === null ? null : Number(center.latitude);
  const longitude = center.longitude === null ? null : Number(center.longitude);
  return {
    id: center.id,
    code: center.code,
    name: center.name,
    responsiblePerson: center.responsiblePerson,
    mobileNo: center.mobileNo,
    address: center.address,
    latitude,
    longitude,
    status: center.status,
    hasCoordinates: latitude !== null && longitude !== null,
    type: { id: center.type.id, code: center.type.code, name: center.type.name },
    territory: center.territory,
    hospital: center.hospital
      ? { id: center.hospital.id, hospitalCategory: center.hospital.hospitalCategory }
      : null,
  };
}

export async function listCenters(filters: CenterFilters): Promise<PagedResult<CenterSummary>> {
  const [centers, total] = await Promise.all([findCenters(filters), countCenters(filters)]);
  return { items: centers.map(toSummary), total, page: filters.page, pageSize: filters.pageSize };
}

export async function getCenter(id: string): Promise<CenterSummary | null> {
  const center = await findCenterById(id);
  return center ? toSummary(center) : null;
}

export async function listActiveCentersForSelection() {
  return listActiveCentersForSelectionRow();
}

export async function getCenterFormOptions() {
  const [types, territories] = await Promise.all([listCenterTypes(), listActiveTerritoryOptions()]);
  return { types, territories };
}

// Confirms the requested extension matches the selected CenterType's code —
// never trusts the shape of the submitted input alone (a form could claim
// `hospital` fields while `typeId` actually resolves to CHEMIST).
async function resolveTypeCode(typeId: string): Promise<string> {
  const types = await listCenterTypes();
  const type = types.find((t) => t.id === typeId);
  if (!type) throw new CenterTypeMismatchError();
  return type.code;
}

function assertExtensionMatchesType(
  typeCode: string,
  input: Pick<CreateCenterInput, "hospital">,
): void {
  if (typeCode === "HOSPITAL" && !input.hospital) throw new CenterTypeMismatchError();
  if (typeCode !== "HOSPITAL" && input.hospital) throw new CenterTypeMismatchError();
}

export async function createCenter(
  input: CreateCenterInput,
  actorId: string,
): Promise<CenterSummary> {
  await assertTerritoryActive(input.territoryId);
  const typeCode = await resolveTypeCode(input.typeId);
  assertExtensionMatchesType(typeCode, input);

  let created: CenterWithRelations;
  try {
    created = await createCenterWithExtension({
      center: {
        code: input.code,
        name: input.name,
        responsiblePerson: input.responsiblePerson ?? null,
        mobileNo: input.mobileNo ?? null,
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

export async function updateCenter(
  input: UpdateCenterInput,
  actorId: string,
): Promise<CenterSummary> {
  await assertTerritoryActive(input.territoryId);
  const typeCode = await resolveTypeCode(input.typeId);
  assertExtensionMatchesType(typeCode, input);

  let updated: CenterWithRelations;
  try {
    updated = await updateCenterWithExtension(input.id, {
      center: {
        code: input.code,
        name: input.name,
        responsiblePerson: input.responsiblePerson ?? null,
        mobileNo: input.mobileNo ?? null,
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
