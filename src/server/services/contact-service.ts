import { slugifyLookupName } from "@/lib/lookup-slug";
import type { PagedResult } from "@/lib/pagination";
import type {
  CenterOption,
  ContactFilters,
  CreateContactInput,
  CreateLookupInput,
  UpdateContactInput,
} from "@/lib/schemas/contact";
import {
  listActiveCentersForSelection,
  listCenterTypes,
} from "@/server/repositories/center-repository";
import {
  type ContactDetailRow,
  type ContactListRow,
  countContacts,
  createContactWithCenters,
  createLookup,
  findCenterRolesByIds,
  findCentersByIds,
  findContactById,
  findContactCenterLinks,
  findContactReferenceIds,
  findContacts,
  findContactTypeById,
  findLookupByCode,
  findSpecializationById,
  listCenterRoles,
  listContactTypes,
  listSpecializations,
  type LookupRow,
  nextContactCodeNumber,
  setContactStatus as setContactStatusRow,
  updateContactWithCenters,
} from "@/server/repositories/contact-repository";
import { findTerritoryById } from "@/server/repositories/territory-repository";
import { listActiveTerritoryOptions } from "@/server/services/territory-service";

export class ContactNotFoundError extends Error {
  constructor() {
    super("Contact not found.");
    this.name = "ContactNotFoundError";
  }
}

// A reference (type, specialization, territory, center, role) that doesn't
// exist at all — never trust an id just because the form offered it.
export class InvalidContactReferenceError extends Error {
  constructor(what: string) {
    super(`The selected ${what} does not exist.`);
    this.name = "InvalidContactReferenceError";
  }
}

// A newly selected Territory or Center that is inactive. An association
// that was already on the Contact and is left untouched is exempt, so a
// Contact stays editable after one of its Centers is later deactivated.
export class InactiveContactReferenceError extends Error {
  constructor(what: string) {
    super(`The selected ${what} is not active.`);
    this.name = "InactiveContactReferenceError";
  }
}

export class DuplicateContactCenterError extends Error {
  constructor() {
    super("This center is already associated with the contact.");
    this.name = "DuplicateContactCenterError";
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

// --- Contact code (isolated so the format can change without touching the
// model or the UI) ---

export function formatContactCode(n: number): string {
  return `CON-${String(n).padStart(5, "0")}`;
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

export type ContactSummary = {
  id: string;
  code: string;
  name: string;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  mobile: string | null;
  status: "ACTIVE" | "INACTIVE";
  contactType: { id: string; code: string; name: string };
  specialization: { id: string; code: string; name: string };
  territory: { id: string; code: string; label: string };
  centerCount: number;
};

export type ContactCenterView = {
  centerId: string;
  code: string;
  name: string;
  typeName: string;
  centerStatus: "ACTIVE" | "INACTIVE";
  roleAtCenterId: string;
  roleName: string;
};

export type ContactDetail = ContactSummary & {
  centers: ContactCenterView[];
  territoryStatus: "ACTIVE" | "INACTIVE";
};

function toSummary(row: ContactListRow): ContactSummary {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    gender: row.gender,
    mobile: row.mobile,
    status: row.status,
    contactType: { id: row.contactType.id, code: row.contactType.code, name: row.contactType.name },
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

function toDetail(row: ContactDetailRow): ContactDetail {
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

export async function listContacts(filters: ContactFilters): Promise<PagedResult<ContactSummary>> {
  const [rows, total] = await Promise.all([findContacts(filters), countContacts(filters)]);
  return { items: rows.map(toSummary), total, page: filters.page, pageSize: filters.pageSize };
}

export async function getContact(id: string): Promise<ContactDetail | null> {
  const row = await findContactById(id);
  return row ? toDetail(row) : null;
}

export type ContactFormOptions = {
  contactTypes: LookupRow[];
  specializations: LookupRow[];
  centerRoles: LookupRow[];
  territories: { id: string; code: string; label: string }[];
  centers: CenterOption[];
};

// `current` (edit only) is merged into the option lists: its Territory or
// Centers may have been deactivated since, and the form still has to be able
// to display what the Contact currently holds.
export async function getContactFormOptions(current?: ContactDetail): Promise<ContactFormOptions> {
  const [contactTypes, specializations, centerRoles, territories, activeCenters, centerTypes] =
    await Promise.all([
      listContactTypes(),
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

  return { contactTypes, specializations, centerRoles, territories: territoryOptions, centers };
}

export async function getContactFilterOptions() {
  const [contactTypes, specializations, centerTypes, territories] = await Promise.all([
    listContactTypes(),
    listSpecializations(),
    listCenterTypes(),
    listActiveTerritoryOptions(),
  ]);
  return { contactTypes, specializations, centerTypes, territories };
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
  CreateContactInput,
  "contactTypeId" | "specializationId" | "territoryId" | "centers"
>;

async function assertReferences(
  input: References,
  current: {
    territoryId?: string;
    centers: { centerId: string; roleAtCenterId: string }[];
  },
): Promise<void> {
  if (!(await findContactTypeById(input.contactTypeId))) {
    throw new InvalidContactReferenceError("contact type");
  }
  if (!(await findSpecializationById(input.specializationId))) {
    throw new InvalidContactReferenceError("specialization");
  }

  const territory = await findTerritoryById(input.territoryId);
  if (!territory) throw new InvalidContactReferenceError("territory");
  if (territory.status === "INACTIVE" && input.territoryId !== current.territoryId) {
    throw new InactiveContactReferenceError("territory");
  }

  const seen = new Set<string>();
  for (const center of input.centers) {
    if (seen.has(center.centerId)) throw new DuplicateContactCenterError();
    seen.add(center.centerId);
  }

  const centerIds = input.centers.map((c) => c.centerId);
  const roleIds = [...new Set(input.centers.map((c) => c.roleAtCenterId))];
  const [centers, roles] = await Promise.all([
    centerIds.length ? findCentersByIds(centerIds) : Promise.resolve([]),
    roleIds.length ? findCenterRolesByIds(roleIds) : Promise.resolve([]),
  ]);
  if (centers.length !== centerIds.length) throw new InvalidContactReferenceError("center");
  if (roles.length !== roleIds.length) throw new InvalidContactReferenceError("role at center");

  const alreadyLinked = new Set(current.centers.map((c) => c.centerId));
  for (const center of centers) {
    if (center.status === "INACTIVE" && !alreadyLinked.has(center.id)) {
      throw new InactiveContactReferenceError("center");
    }
  }
}

export async function createContact(
  input: CreateContactInput,
  actorId: string,
): Promise<ContactDetail> {
  await assertReferences(input, { centers: [] });

  const data = {
    name: input.name,
    gender: input.gender ?? null,
    mobile: input.mobile ?? null,
    contactTypeId: input.contactTypeId,
    specializationId: input.specializationId,
    territoryId: input.territoryId,
  };

  // The code comes from a Postgres sequence, so collisions shouldn't occur;
  // the retry only covers a manually inserted CON-xxxxx row that the
  // sequence hasn't caught up with.
  for (let tries = 0; tries < 5; tries++) {
    const code = formatContactCode(await nextContactCodeNumber());
    try {
      return toDetail(await createContactWithCenters({ ...data, code }, input.centers, actorId));
    } catch (error) {
      if (isUniqueConstraintViolation(error) && targets(error, "code")) continue;
      throw error;
    }
  }
  throw new Error("Could not generate a unique contact code.");
}

export async function updateContact(
  input: UpdateContactInput,
  actorId: string,
): Promise<ContactDetail> {
  const existing = await findContactReferenceIds(input.id);
  if (!existing) throw new ContactNotFoundError();
  const currentLinks = await findContactCenterLinks(input.id);

  await assertReferences(input, { territoryId: existing.territoryId, centers: currentLinks });

  // `code` is not in the payload: it is immutable.
  const updated = await updateContactWithCenters(
    input.id,
    {
      name: input.name,
      gender: input.gender ?? null,
      mobile: input.mobile ?? null,
      contactTypeId: input.contactTypeId,
      specializationId: input.specializationId,
      territoryId: input.territoryId,
      ...(input.status ? { status: input.status } : {}),
    },
    input.centers,
    actorId,
  );
  return toDetail(updated);
}

// Deactivation never deletes: the Contact and its Center links stay intact
// for history.
export async function setContactStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE",
  actorId: string,
): Promise<void> {
  if (!(await findContactReferenceIds(id))) throw new ContactNotFoundError();
  await setContactStatusRow(id, status, actorId);
}
