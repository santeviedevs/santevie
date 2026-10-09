import { toSkipTake } from "@/lib/pagination";
import type { ContactFilters, LookupKind } from "@/lib/schemas/contact";
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

// List rows only need how many Centers a Contact has, not the Centers
// themselves — a _count avoids loading (and N+1-ing) every association.
const listInclude = {
  contactType: true,
  specialization: true,
  territory: territorySelect,
  _count: { select: { centers: true } },
} satisfies Prisma.ContactInclude;

const detailInclude = {
  contactType: true,
  specialization: true,
  territory: territorySelect,
  centers: {
    include: {
      roleAtCenter: true,
      center: { select: { id: true, code: true, name: true, status: true, type: true } },
    },
    orderBy: { center: { name: "asc" } },
  },
  _count: { select: { centers: true } },
} satisfies Prisma.ContactInclude;

export type ContactListRow = Prisma.ContactGetPayload<{ include: typeof listInclude }>;
export type ContactDetailRow = Prisma.ContactGetPayload<{ include: typeof detailInclude }>;

// Contacts are organisation-wide for ADMIN and MANAGER — there is deliberately
// no scope/hierarchy filter here (see server/scope.ts, which is for
// user-attributable rows).
function buildWhere(filters: ContactFilters): Prisma.ContactWhereInput {
  return {
    ...(filters.contactTypeId ? { contactTypeId: filters.contactTypeId } : {}),
    ...(filters.specializationId ? { specializationId: filters.specializationId } : {}),
    ...(filters.territoryId ? { territoryId: filters.territoryId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.centerTypeId
      ? { centers: { some: { center: { typeId: filters.centerTypeId } } } }
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

export function findContacts(filters: ContactFilters): Promise<ContactListRow[]> {
  return prisma.contact.findMany({
    where: buildWhere(filters),
    include: listInclude,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    ...toSkipTake(filters),
  });
}

export function countContacts(filters: ContactFilters): Promise<number> {
  return prisma.contact.count({ where: buildWhere(filters) });
}

export function findContactById(id: string): Promise<ContactDetailRow | null> {
  return prisma.contact.findUnique({ where: { id }, include: detailInclude });
}

// Existing links, so an edit can tell which associations are untouched
// (exempt from the active-reference check) from new or changed ones.
export function findContactCenterLinks(contactId: string) {
  return prisma.contactCenter.findMany({
    where: { contactId },
    select: { centerId: true, roleAtCenterId: true },
  });
}

export function findContactReferenceIds(contactId: string) {
  return prisma.contact.findUnique({
    where: { id: contactId },
    select: { contactTypeId: true, specializationId: true, territoryId: true },
  });
}

// --- Lookups ---

export function listContactTypes() {
  return prisma.contactType.findMany({
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
  return prisma.contactCenterRole.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });
}

export function findContactTypeById(id: string) {
  return prisma.contactType.findUnique({ where: { id }, select: { id: true } });
}

export function findSpecializationById(id: string) {
  return prisma.specialization.findUnique({ where: { id }, select: { id: true } });
}

export function findCenterRolesByIds(ids: string[]) {
  return prisma.contactCenterRole.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
}

export function findCentersByIds(ids: string[]) {
  return prisma.center.findMany({
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
    case "contactType":
      return prisma.contactType.findUnique({ where, select });
    case "specialization":
      return prisma.specialization.findUnique({ where, select });
    case "centerRole":
      return prisma.contactCenterRole.findUnique({ where, select });
  }
}

export function createLookup(kind: LookupKind, data: LookupData): Promise<LookupRow> {
  const select = { id: true, code: true, name: true };
  switch (kind) {
    case "contactType":
      return prisma.contactType.create({ data, select });
    case "specialization":
      return prisma.specialization.create({ data, select });
    case "centerRole":
      return prisma.contactCenterRole.create({ data, select });
  }
}

// --- Contact code ---

export async function nextContactCodeNumber(): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`SELECT nextval('contact_code_seq') AS n`;
  return Number(rows[0]!.n);
}

// --- Writes ---

export type ContactCenterData = { centerId: string; roleAtCenterId: string };

type ContactWriteData = {
  name: string;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  mobile: string | null;
  contactTypeId: string;
  specializationId: string;
  territoryId: string;
};

// The Contact and its Center links are written in a single nested create, so
// a failure partway can never leave a Contact with a partial set of links.
export function createContactWithCenters(
  data: ContactWriteData & { code: string },
  centers: ContactCenterData[],
  actorId: string,
): Promise<ContactDetailRow> {
  return prisma.contact.create({
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
export function updateContactWithCenters(
  id: string,
  data: ContactWriteData & { status?: "ACTIVE" | "INACTIVE" },
  centers: ContactCenterData[],
  actorId: string,
): Promise<ContactDetailRow> {
  return prisma.$transaction(async (tx) => {
    await tx.contactCenter.deleteMany({
      where: { contactId: id, centerId: { notIn: centers.map((c) => c.centerId) } },
    });
    for (const center of centers) {
      await tx.contactCenter.upsert({
        where: { contactId_centerId: { contactId: id, centerId: center.centerId } },
        update: { roleAtCenterId: center.roleAtCenterId, updatedBy: actorId },
        create: { contactId: id, ...center, createdBy: actorId, updatedBy: actorId },
      });
    }
    return tx.contact.update({
      where: { id },
      data: { ...data, updatedBy: actorId },
      include: detailInclude,
    });
  });
}

export function setContactStatus(id: string, status: "ACTIVE" | "INACTIVE", actorId: string) {
  return prisma.contact.update({
    where: { id },
    data: { status, updatedBy: actorId },
    select: { id: true },
  });
}
