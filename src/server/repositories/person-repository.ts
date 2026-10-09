import { toSkipTake } from "@/lib/pagination";
import type { LookupKind, PersonFilters } from "@/lib/schemas/person";
import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

const territorySelect = {
  select: {
    id: true,
    code: true,
    status: true,
    province: { select: { id: true, name: true } },
    ville: { select: { id: true, name: true } },
    commune: { select: { id: true, name: true } },
    quartier: { select: { id: true, name: true } },
  },
} satisfies { select: Prisma.TerritorySelect };

// List rows only need how many Centers a Person has, not the Centers
// themselves — a _count avoids loading (and N+1-ing) every association.
const listInclude = {
  personType: true,
  specialization: true,
  territory: territorySelect,
  _count: { select: { centers: true } },
} satisfies Prisma.PersonInclude;

const detailInclude = {
  personType: true,
  specialization: true,
  territory: territorySelect,
  centers: {
    include: {
      roleAtCenter: true,
      client: { select: { id: true, code: true, name: true, status: true, type: true } },
    },
    orderBy: { client: { name: "asc" } },
  },
  _count: { select: { centers: true } },
} satisfies Prisma.PersonInclude;

export type PersonListRow = Prisma.PersonGetPayload<{ include: typeof listInclude }>;
export type PersonDetailRow = Prisma.PersonGetPayload<{ include: typeof detailInclude }>;

// Persons are organisation-wide for ADMIN and MANAGER — there is deliberately
// no scope/hierarchy filter here (see server/scope.ts, which is for
// user-attributable rows).
function buildWhere(filters: PersonFilters): Prisma.PersonWhereInput {
  return {
    ...(filters.personTypeId ? { personTypeId: filters.personTypeId } : {}),
    ...(filters.specializationId ? { specializationId: filters.specializationId } : {}),
    ...(filters.territoryId ? { territoryId: filters.territoryId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.clientTypeId
      ? { centers: { some: { client: { typeId: filters.clientTypeId } } } }
      : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" } },
            { code: { contains: filters.q, mode: "insensitive" } },
            { mobile: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export function findPersons(filters: PersonFilters): Promise<PersonListRow[]> {
  return prisma.person.findMany({
    where: buildWhere(filters),
    include: listInclude,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    ...toSkipTake(filters),
  });
}

export function countPersons(filters: PersonFilters): Promise<number> {
  return prisma.person.count({ where: buildWhere(filters) });
}

export function findPersonById(id: string): Promise<PersonDetailRow | null> {
  return prisma.person.findUnique({ where: { id }, include: detailInclude });
}

// Existing links, so an edit can tell which associations are untouched
// (exempt from the active-reference check) from new or changed ones.
export function findPersonCenterLinks(personId: string) {
  return prisma.personCenter.findMany({
    where: { personId },
    select: { clientId: true, roleAtCenterId: true },
  });
}

export function findPersonReferenceIds(personId: string) {
  return prisma.person.findUnique({
    where: { id: personId },
    select: { personTypeId: true, specializationId: true, territoryId: true },
  });
}

// --- Lookups ---

export function listPersonTypes() {
  return prisma.personType.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });
}

export function listSpecializations() {
  return prisma.specialization.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });
}

export function listCenterRoles() {
  return prisma.personCenterRole.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });
}

export function findPersonTypeById(id: string) {
  return prisma.personType.findUnique({ where: { id }, select: { id: true } });
}

export function findSpecializationById(id: string) {
  return prisma.specialization.findUnique({ where: { id }, select: { id: true } });
}

export function findCenterRolesByIds(ids: string[]) {
  return prisma.personCenterRole.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
}

export function findCentersByIds(ids: string[]) {
  return prisma.client.findMany({
    where: { id: { in: ids } },
    select: { id: true, status: true },
  });
}

export type LookupRow = { id: string; code: string; name: string };

type LookupData = { code: string; name: string; createdBy: string; updatedBy: string };

// Case-insensitive lookup by code — the code is the name's normalised slug,
// so this is also how a typed value is matched to an existing row.
export function findLookupByCode(kind: LookupKind, code: string): Promise<LookupRow | null> {
  const where = { code };
  const select = { id: true, code: true, name: true };
  switch (kind) {
    case "personType":
      return prisma.personType.findUnique({ where, select });
    case "specialization":
      return prisma.specialization.findUnique({ where, select });
    case "centerRole":
      return prisma.personCenterRole.findUnique({ where, select });
  }
}

export function createLookup(kind: LookupKind, data: LookupData): Promise<LookupRow> {
  const select = { id: true, code: true, name: true };
  switch (kind) {
    case "personType":
      return prisma.personType.create({ data, select });
    case "specialization":
      return prisma.specialization.create({ data, select });
    case "centerRole":
      return prisma.personCenterRole.create({ data, select });
  }
}

// --- Person code ---

export async function nextPersonCodeNumber(): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`SELECT nextval('person_code_seq') AS n`;
  return Number(rows[0]!.n);
}

// --- Writes ---

export type PersonCenterData = { clientId: string; roleAtCenterId: string };

type PersonWriteData = {
  name: string;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  mobile: string | null;
  personTypeId: string;
  specializationId: string;
  territoryId: string;
};

// The Person and its Center links are written in a single nested create, so
// a failure partway can never leave a Person with a partial set of links.
export function createPersonWithCenters(
  data: PersonWriteData & { code: string },
  centers: PersonCenterData[],
  actorId: string,
): Promise<PersonDetailRow> {
  return prisma.person.create({
    data: {
      ...data,
      status: "ACTIVE",
      createdBy: actorId,
      updatedBy: actorId,
      centers: {
        create: centers.map((c) => ({ ...c, createdBy: actorId, updatedBy: actorId })),
      },
    },
    include: detailInclude,
  });
}

// `code` is intentionally absent from the update payload — it never changes.
export function updatePersonWithCenters(
  id: string,
  data: PersonWriteData & { status?: "ACTIVE" | "INACTIVE" },
  centers: PersonCenterData[],
  actorId: string,
): Promise<PersonDetailRow> {
  return prisma.$transaction(async (tx) => {
    await tx.personCenter.deleteMany({
      where: { personId: id, clientId: { notIn: centers.map((c) => c.clientId) } },
    });
    for (const center of centers) {
      await tx.personCenter.upsert({
        where: { personId_clientId: { personId: id, clientId: center.clientId } },
        update: { roleAtCenterId: center.roleAtCenterId, updatedBy: actorId },
        create: { personId: id, ...center, createdBy: actorId, updatedBy: actorId },
      });
    }
    return tx.person.update({
      where: { id },
      data: { ...data, updatedBy: actorId },
      include: detailInclude,
    });
  });
}

export function setPersonStatus(id: string, status: "ACTIVE" | "INACTIVE", actorId: string) {
  return prisma.person.update({
    where: { id },
    data: { status, updatedBy: actorId },
    select: { id: true },
  });
}
