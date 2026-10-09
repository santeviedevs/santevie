import { slugifyLookupName } from "@/lib/lookup-slug";
import type { PagedResult } from "@/lib/pagination";
import type {
  CenterOption,
  CreateLookupInput,
  CreatePersonInput,
  PersonFilters,
  UpdatePersonInput,
} from "@/lib/schemas/person";
import {
  listActiveCentersForSelection,
  listCenterTypes,
} from "@/server/repositories/center-repository";
import {
  countPersons,
  createLookup,
  createPersonWithCenters,
  findCenterRolesByIds,
  findCentersByIds,
  findLookupByCode,
  findPersonById,
  findPersonCenterLinks,
  findPersonReferenceIds,
  findPersons,
  findPersonTypeById,
  findSpecializationById,
  listCenterRoles,
  listPersonTypes,
  listSpecializations,
  type LookupRow,
  nextPersonCodeNumber,
  type PersonDetailRow,
  type PersonListRow,
  setPersonStatus as setPersonStatusRow,
  updatePersonWithCenters,
} from "@/server/repositories/person-repository";
import { findTerritoryById } from "@/server/repositories/territory-repository";
import { listActiveTerritoryOptions } from "@/server/services/territory-service";

export class PersonNotFoundError extends Error {
  constructor() {
    super("Person not found.");
    this.name = "PersonNotFoundError";
  }
}

// A reference (type, specialization, territory, center, role) that doesn't
// exist at all — never trust an id just because the form offered it.
export class InvalidPersonReferenceError extends Error {
  constructor(what: string) {
    super(`The selected ${what} does not exist.`);
    this.name = "InvalidPersonReferenceError";
  }
}

// A newly selected Territory or Center that is inactive. An association
// that was already on the Person and is left untouched is exempt, so a
// Person stays editable after one of its Centers is later deactivated.
export class InactivePersonReferenceError extends Error {
  constructor(what: string) {
    super(`The selected ${what} is not active.`);
    this.name = "InactivePersonReferenceError";
  }
}

export class DuplicatePersonCenterError extends Error {
  constructor() {
    super("This center is already associated with the person.");
    this.name = "DuplicatePersonCenterError";
  }
}

export class InvalidLookupNameError extends Error {
  constructor() {
    super("Enter a name containing at least one letter or digit.");
    this.name = "InvalidLookupNameError";
  }
}

function isUniqueConstraintViolation(
  error: unknown,
): error is { code: string; meta?: { target?: unknown } } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

function targets(error: { meta?: { target?: unknown } }, needle: string): boolean {
  const target = error.meta?.target;
  return typeof target === "string"
    ? target.includes(needle)
    : Array.isArray(target) && target.some((t) => String(t).includes(needle));
}

// --- Person code (isolated so the format can change without touching the
// model or the UI) ---

export function formatPersonCode(n: number): string {
  return `PER-${String(n).padStart(5, "0")}`;
}

// --- DTOs (never hand a Prisma row to the client) ---

type TerritoryLike = {
  id: string;
  code: string;
  province: { name: string };
  ville: { name: string } | null;
  commune: { name: string } | null;
  quartier: { name: string } | null;
};

function territoryLabel(t: TerritoryLike): string {
  return [t.province.name, t.ville?.name, t.commune?.name, t.quartier?.name]
    .filter(Boolean)
    .join(" › ");
}

export type PersonSummary = {
  id: string;
  code: string;
  name: string;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  mobile: string | null;
  status: "ACTIVE" | "INACTIVE";
  personType: { id: string; code: string; name: string };
  specialization: { id: string; code: string; name: string };
  territory: { id: string; code: string; label: string };
  centerCount: number;
};

export type PersonCenterView = {
  centerId: string;
  code: string;
  name: string;
  typeName: string;
  centerStatus: "ACTIVE" | "INACTIVE";
  roleAtCenterId: string;
  roleName: string;
};

export type PersonDetail = PersonSummary & {
  centers: PersonCenterView[];
  territoryStatus: "ACTIVE" | "INACTIVE";
};

function toSummary(row: PersonListRow): PersonSummary {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    gender: row.gender,
    mobile: row.mobile,
    status: row.status,
    personType: { id: row.personType.id, code: row.personType.code, name: row.personType.name },
    specialization: {
      id: row.specialization.id,
      code: row.specialization.code,
      name: row.specialization.name,
    },
    territory: {
      id: row.territory.id,
      code: row.territory.code,
      label: territoryLabel(row.territory),
    },
    centerCount: row._count.centers,
  };
}

function toDetail(row: PersonDetailRow): PersonDetail {
  return {
    ...toSummary(row),
    territoryStatus: row.territory.status,
    centers: row.centers.map((link) => ({
      centerId: link.center.id,
      code: link.center.code,
      name: link.center.name,
      typeName: link.center.type.name,
      centerStatus: link.center.status,
      roleAtCenterId: link.roleAtCenter.id,
      roleName: link.roleAtCenter.name,
    })),
  };
}

// --- Reads ---

export async function listPersons(filters: PersonFilters): Promise<PagedResult<PersonSummary>> {
  const [rows, total] = await Promise.all([findPersons(filters), countPersons(filters)]);
  return { items: rows.map(toSummary), total, page: filters.page, pageSize: filters.pageSize };
}

export async function getPerson(id: string): Promise<PersonDetail | null> {
  const row = await findPersonById(id);
  return row ? toDetail(row) : null;
}

export type PersonFormOptions = {
  personTypes: LookupRow[];
  specializations: LookupRow[];
  centerRoles: LookupRow[];
  territories: { id: string; code: string; label: string }[];
  centers: CenterOption[];
};

// `current` (edit only) is merged into the option lists: its Territory or
// Centers may have been deactivated since, and the form still has to be able
// to display what the Person currently holds.
export async function getPersonFormOptions(current?: PersonDetail): Promise<PersonFormOptions> {
  const [personTypes, specializations, centerRoles, territories, activeCenters, centerTypes] =
    await Promise.all([
      listPersonTypes(),
      listSpecializations(),
      listCenterRoles(),
      listActiveTerritoryOptions(),
      listActiveCentersForSelection(),
      listCenterTypes(),
    ]);
  const typeNameById = new Map(centerTypes.map((t) => [t.id, t.name]));

  const centers: CenterOption[] = activeCenters.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    typeName: typeNameById.get(c.typeId) ?? "",
  }));
  for (const link of current?.centers ?? []) {
    if (!centers.some((c) => c.id === link.centerId)) {
      centers.push({
        id: link.centerId,
        code: link.code,
        name: link.name,
        typeName: link.typeName,
      });
    }
  }

  const territoryOptions = [...territories];
  if (current && !territoryOptions.some((t) => t.id === current.territory.id)) {
    territoryOptions.push(current.territory);
  }

  return { personTypes, specializations, centerRoles, territories: territoryOptions, centers };
}

export async function getPersonFilterOptions() {
  const [personTypes, specializations, centerTypes, territories] = await Promise.all([
    listPersonTypes(),
    listSpecializations(),
    listCenterTypes(),
    listActiveTerritoryOptions(),
  ]);
  return { personTypes, specializations, centerTypes, territories };
}

// --- Lookup create-or-select ---

// The slug rule itself lives in lib/lookup-slug.ts, shared with the seed.
export { slugifyLookupName };

// Returns the existing row when the typed name matches one (so the combobox
// can treat "create" as "select" without a race), otherwise creates it.
export async function createLookupValue(
  input: CreateLookupInput,
  actorId: string,
): Promise<LookupRow> {
  const code = slugifyLookupName(input.name);
  if (!code) throw new InvalidLookupNameError();

  const existing = await findLookupByCode(input.kind, code);
  if (existing) return existing;

  try {
    return await createLookup(input.kind, {
      code,
      name: input.name,
      createdBy: actorId,
      updatedBy: actorId,
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      const raced = await findLookupByCode(input.kind, code);
      if (raced) return raced;
    }
    throw error;
  }
}

// --- Writes ---

type References = Pick<
  CreatePersonInput,
  "personTypeId" | "specializationId" | "territoryId" | "centers"
>;

async function assertReferences(
  input: References,
  current: {
    territoryId?: string;
    centers: { centerId: string; roleAtCenterId: string }[];
  },
): Promise<void> {
  if (!(await findPersonTypeById(input.personTypeId))) {
    throw new InvalidPersonReferenceError("person type");
  }
  if (!(await findSpecializationById(input.specializationId))) {
    throw new InvalidPersonReferenceError("specialization");
  }

  const territory = await findTerritoryById(input.territoryId);
  if (!territory) throw new InvalidPersonReferenceError("territory");
  if (territory.status === "INACTIVE" && input.territoryId !== current.territoryId) {
    throw new InactivePersonReferenceError("territory");
  }

  const seen = new Set<string>();
  for (const center of input.centers) {
    if (seen.has(center.centerId)) throw new DuplicatePersonCenterError();
    seen.add(center.centerId);
  }

  const centerIds = input.centers.map((c) => c.centerId);
  const roleIds = [...new Set(input.centers.map((c) => c.roleAtCenterId))];
  const [centers, roles] = await Promise.all([
    centerIds.length ? findCentersByIds(centerIds) : Promise.resolve([]),
    roleIds.length ? findCenterRolesByIds(roleIds) : Promise.resolve([]),
  ]);
  if (centers.length !== centerIds.length) throw new InvalidPersonReferenceError("center");
  if (roles.length !== roleIds.length) throw new InvalidPersonReferenceError("role at center");

  const alreadyLinked = new Set(current.centers.map((c) => c.centerId));
  for (const center of centers) {
    if (center.status === "INACTIVE" && !alreadyLinked.has(center.id)) {
      throw new InactivePersonReferenceError("center");
    }
  }
}

export async function createPerson(
  input: CreatePersonInput,
  actorId: string,
): Promise<PersonDetail> {
  await assertReferences(input, { centers: [] });

  const data = {
    name: input.name,
    gender: input.gender ?? null,
    mobile: input.mobile ?? null,
    personTypeId: input.personTypeId,
    specializationId: input.specializationId,
    territoryId: input.territoryId,
  };

  // The code comes from a Postgres sequence, so collisions shouldn't occur;
  // the retry only covers a manually inserted PER-xxxxx row that the
  // sequence hasn't caught up with.
  for (let tries = 0; tries < 5; tries++) {
    const code = formatPersonCode(await nextPersonCodeNumber());
    try {
      return toDetail(await createPersonWithCenters({ ...data, code }, input.centers, actorId));
    } catch (error) {
      if (isUniqueConstraintViolation(error) && targets(error, "code")) continue;
      throw error;
    }
  }
  throw new Error("Could not generate a unique person code.");
}

export async function updatePerson(
  input: UpdatePersonInput,
  actorId: string,
): Promise<PersonDetail> {
  const existing = await findPersonReferenceIds(input.id);
  if (!existing) throw new PersonNotFoundError();
  const currentLinks = await findPersonCenterLinks(input.id);

  await assertReferences(input, { territoryId: existing.territoryId, centers: currentLinks });

  // `code` is not in the payload: it is immutable.
  const updated = await updatePersonWithCenters(
    input.id,
    {
      name: input.name,
      gender: input.gender ?? null,
      mobile: input.mobile ?? null,
      personTypeId: input.personTypeId,
      specializationId: input.specializationId,
      territoryId: input.territoryId,
      ...(input.status ? { status: input.status } : {}),
    },
    input.centers,
    actorId,
  );
  return toDetail(updated);
}

// Deactivation never deletes: the Person and its Center links stay intact
// for history.
export async function setPersonStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE",
  actorId: string,
): Promise<void> {
  if (!(await findPersonReferenceIds(id))) throw new PersonNotFoundError();
  await setPersonStatusRow(id, status, actorId);
}
