import type { TerritoryFilters } from "@/lib/schemas/territory";
import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

type Status = "ACTIVE" | "INACTIVE";

// --- Province ---

export type ProvinceRow = Prisma.ProvinceGetPayload<Record<string, never>>;

export function createProvince(data: Prisma.ProvinceCreateInput): Promise<ProvinceRow> {
  return prisma.province.create({ data });
}

export function findProvinceById(id: string) {
  return prisma.province.findUnique({ where: { id }, select: { id: true, status: true } });
}

export function setProvinceStatus(
  id: string,
  status: Status,
  actorId: string,
): Promise<ProvinceRow> {
  return prisma.province.update({ where: { id }, data: { status, updatedBy: actorId } });
}

export function updateProvince(id: string, data: Prisma.ProvinceUpdateInput): Promise<ProvinceRow> {
  return prisma.province.update({ where: { id }, data });
}

// --- Ville ---

export type VilleRow = Prisma.VilleGetPayload<Record<string, never>>;

export function createVille(data: Prisma.VilleCreateInput): Promise<VilleRow> {
  return prisma.ville.create({ data });
}

// Looked up when an "existing" Ville is picked, so the service can confirm
// it actually belongs to the selected Province before trusting it — also
// doubles as the parent lookup for the activation guard (status).
export function findVilleById(id: string) {
  return prisma.ville.findUnique({
    where: { id },
    select: { id: true, provinceId: true, status: true },
  });
}

export function setVilleStatus(id: string, status: Status, actorId: string): Promise<VilleRow> {
  return prisma.ville.update({ where: { id }, data: { status, updatedBy: actorId } });
}

export function updateVille(id: string, data: Prisma.VilleUpdateInput): Promise<VilleRow> {
  return prisma.ville.update({ where: { id }, data });
}

// --- Commune ---

export type CommuneRow = Prisma.CommuneGetPayload<Record<string, never>>;

export function createCommune(data: Prisma.CommuneCreateInput): Promise<CommuneRow> {
  return prisma.commune.create({ data });
}

// Looked up when an "existing" Commune is picked, so the service can confirm
// it actually belongs to the selected Ville before trusting it — also
// doubles as the parent lookup for the activation guard (status).
export function findCommuneById(id: string) {
  return prisma.commune.findUnique({
    where: { id },
    select: { id: true, villeId: true, status: true },
  });
}

export function setCommuneStatus(id: string, status: Status, actorId: string): Promise<CommuneRow> {
  return prisma.commune.update({ where: { id }, data: { status, updatedBy: actorId } });
}

export function updateCommune(id: string, data: Prisma.CommuneUpdateInput): Promise<CommuneRow> {
  return prisma.commune.update({ where: { id }, data });
}

// --- Quartier ---
//
// Quartier is the record the Territories admin screen actually manages —
// one row per territory, carrying its full Province/Ville/Commune path.

const quartierInclude = {
  commune: {
    include: {
      ville: { include: { province: { select: { id: true, name: true, status: true } } } },
    },
  },
} satisfies Prisma.QuartierInclude;

export type QuartierRow = Prisma.QuartierGetPayload<{ include: typeof quartierInclude }>;

function buildQuartierWhere(filters: TerritoryFilters): Prisma.QuartierWhereInput {
  return {
    ...(filters.communeId ? { communeId: filters.communeId } : {}),
    ...(filters.villeId ? { commune: { villeId: filters.villeId } } : {}),
    ...(filters.provinceId ? { commune: { ville: { provinceId: filters.provinceId } } } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q ? { name: { contains: filters.q, mode: "insensitive" } } : {}),
  };
}

export function findQuartiers(filters: TerritoryFilters): Promise<QuartierRow[]> {
  return prisma.quartier.findMany({
    where: buildQuartierWhere(filters),
    include: quartierInclude,
    orderBy: { name: "asc" },
  });
}

export function findQuartierById(id: string): Promise<QuartierRow | null> {
  return prisma.quartier.findUnique({ where: { id }, include: quartierInclude });
}

export function createQuartier(data: Prisma.QuartierCreateInput): Promise<QuartierRow> {
  return prisma.quartier.create({ data, include: quartierInclude });
}

export function updateQuartier(id: string, data: Prisma.QuartierUpdateInput): Promise<QuartierRow> {
  return prisma.quartier.update({ where: { id }, data, include: quartierInclude });
}

export function setQuartierStatus(
  id: string,
  status: Status,
  actorId: string,
): Promise<QuartierRow> {
  return prisma.quartier.update({
    where: { id },
    data: { status, updatedBy: actorId },
    include: quartierInclude,
  });
}

export async function countQuartierDependents(
  quartierId: string,
): Promise<{ activeClients: number; activeUsers: number }> {
  const [activeClients, activeUsers] = await Promise.all([
    prisma.client.count({ where: { quartierId, status: "ACTIVE" } }),
    prisma.user.count({ where: { quartierId, status: "ACTIVE" } }),
  ]);
  return { activeClients, activeUsers };
}

// --- Combined territory entries (any level) ---
//
// A Territory can now be a Province, Ville, Commune, or Quartier row on its
// own — not just the leaf Quartier. These build the same shape of filter as
// `buildQuartierWhere` for each shallower level, and `findTerritoryEntryById`
// looks an id up across all four tables (most-specific first, since that's
// the common case) rather than needing the level encoded in the URL.

const villeWithProvinceInclude = {
  province: { select: { id: true, name: true } },
} satisfies Prisma.VilleInclude;
export type VilleWithProvinceRow = Prisma.VilleGetPayload<{
  include: typeof villeWithProvinceInclude;
}>;

const communeWithAncestryInclude = {
  ville: { include: { province: { select: { id: true, name: true } } } },
} satisfies Prisma.CommuneInclude;
export type CommuneWithAncestryRow = Prisma.CommuneGetPayload<{
  include: typeof communeWithAncestryInclude;
}>;

function buildProvinceWhere(filters: TerritoryFilters): Prisma.ProvinceWhereInput {
  return {
    ...(filters.provinceId ? { id: filters.provinceId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q ? { name: { contains: filters.q, mode: "insensitive" } } : {}),
  };
}

function buildVilleWhere(filters: TerritoryFilters): Prisma.VilleWhereInput {
  return {
    ...(filters.villeId ? { id: filters.villeId } : {}),
    ...(filters.provinceId ? { provinceId: filters.provinceId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q ? { name: { contains: filters.q, mode: "insensitive" } } : {}),
  };
}

function buildCommuneWhere(filters: TerritoryFilters): Prisma.CommuneWhereInput {
  return {
    ...(filters.communeId ? { id: filters.communeId } : {}),
    ...(filters.villeId ? { villeId: filters.villeId } : {}),
    ...(filters.provinceId ? { ville: { provinceId: filters.provinceId } } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q ? { name: { contains: filters.q, mode: "insensitive" } } : {}),
  };
}

// A `villeId` or `communeId` filter narrows to a level at or below it —
// Province-level (and, for a `communeId` filter, Ville-level) rows can
// never match, so the caller skips querying those levels entirely rather
// than filtering them down to nothing here.
export function findProvinces(filters: TerritoryFilters): Promise<ProvinceRow[]> {
  return prisma.province.findMany({ where: buildProvinceWhere(filters), orderBy: { name: "asc" } });
}

export function findVilles(filters: TerritoryFilters): Promise<VilleWithProvinceRow[]> {
  return prisma.ville.findMany({
    where: buildVilleWhere(filters),
    include: villeWithProvinceInclude,
    orderBy: { name: "asc" },
  });
}

export function findCommunes(filters: TerritoryFilters): Promise<CommuneWithAncestryRow[]> {
  return prisma.commune.findMany({
    where: buildCommuneWhere(filters),
    include: communeWithAncestryInclude,
    orderBy: { name: "asc" },
  });
}

export type TerritoryEntryRow =
  | { level: "quartier"; row: QuartierRow }
  | { level: "commune"; row: CommuneWithAncestryRow }
  | { level: "ville"; row: VilleWithProvinceRow }
  | { level: "province"; row: ProvinceRow };

export async function findTerritoryEntryById(id: string): Promise<TerritoryEntryRow | null> {
  const quartier = await prisma.quartier.findUnique({ where: { id }, include: quartierInclude });
  if (quartier) return { level: "quartier", row: quartier };

  const commune = await prisma.commune.findUnique({
    where: { id },
    include: communeWithAncestryInclude,
  });
  if (commune) return { level: "commune", row: commune };

  const ville = await prisma.ville.findUnique({ where: { id }, include: villeWithProvinceInclude });
  if (ville) return { level: "ville", row: ville };

  const province = await prisma.province.findUnique({ where: { id } });
  if (province) return { level: "province", row: province };

  return null;
}

// --- Descendant lookups & cascade status updates ---
//
// Both User and Client can be assigned at any of the four levels directly
// (see each model's four independent optional FKs). Deactivating a level
// must therefore both (a) know every descendant id, to cascade INACTIVE
// down to them, and (b) count active Users/Clients across the *whole*
// affected subtree, not just the level itself, before allowing it.

export async function getProvinceDescendantIds(
  provinceId: string,
): Promise<{ villeIds: string[]; communeIds: string[]; quartierIds: string[] }> {
  const villes = await prisma.ville.findMany({ where: { provinceId }, select: { id: true } });
  const villeIds = villes.map((v) => v.id);
  const communes = await prisma.commune.findMany({
    where: { villeId: { in: villeIds } },
    select: { id: true },
  });
  const communeIds = communes.map((c) => c.id);
  const quartiers = await prisma.quartier.findMany({
    where: { communeId: { in: communeIds } },
    select: { id: true },
  });
  return { villeIds, communeIds, quartierIds: quartiers.map((q) => q.id) };
}

export async function getVilleDescendantIds(
  villeId: string,
): Promise<{ communeIds: string[]; quartierIds: string[] }> {
  const communes = await prisma.commune.findMany({ where: { villeId }, select: { id: true } });
  const communeIds = communes.map((c) => c.id);
  const quartiers = await prisma.quartier.findMany({
    where: { communeId: { in: communeIds } },
    select: { id: true },
  });
  return { communeIds, quartierIds: quartiers.map((q) => q.id) };
}

export async function getCommuneDescendantIds(
  communeId: string,
): Promise<{ quartierIds: string[] }> {
  const quartiers = await prisma.quartier.findMany({ where: { communeId }, select: { id: true } });
  return { quartierIds: quartiers.map((q) => q.id) };
}

export async function countActiveDependents(scope: {
  provinceIds?: string[];
  villeIds?: string[];
  communeIds?: string[];
  quartierIds?: string[];
}): Promise<{ activeClients: number; activeUsers: number }> {
  const userOr: Prisma.UserWhereInput[] = [];
  const clientOr: Prisma.ClientWhereInput[] = [];
  if (scope.provinceIds?.length) {
    userOr.push({ provinceId: { in: scope.provinceIds } });
    clientOr.push({ provinceId: { in: scope.provinceIds } });
  }
  if (scope.villeIds?.length) {
    userOr.push({ villeId: { in: scope.villeIds } });
    clientOr.push({ villeId: { in: scope.villeIds } });
  }
  if (scope.communeIds?.length) {
    userOr.push({ communeId: { in: scope.communeIds } });
    clientOr.push({ communeId: { in: scope.communeIds } });
  }
  if (scope.quartierIds?.length) {
    userOr.push({ quartierId: { in: scope.quartierIds } });
    clientOr.push({ quartierId: { in: scope.quartierIds } });
  }

  const [activeUsers, activeClients] = await Promise.all([
    userOr.length ? prisma.user.count({ where: { status: "ACTIVE", OR: userOr } }) : 0,
    clientOr.length ? prisma.client.count({ where: { status: "ACTIVE", OR: clientOr } }) : 0,
  ]);
  return { activeClients, activeUsers };
}

export function cascadeDeactivateProvince(
  id: string,
  descendants: { villeIds: string[]; communeIds: string[]; quartierIds: string[] },
  actorId: string,
) {
  return prisma.$transaction([
    prisma.province.update({ where: { id }, data: { status: "INACTIVE", updatedBy: actorId } }),
    prisma.ville.updateMany({
      where: { id: { in: descendants.villeIds } },
      data: { status: "INACTIVE", updatedBy: actorId },
    }),
    prisma.commune.updateMany({
      where: { id: { in: descendants.communeIds } },
      data: { status: "INACTIVE", updatedBy: actorId },
    }),
    prisma.quartier.updateMany({
      where: { id: { in: descendants.quartierIds } },
      data: { status: "INACTIVE", updatedBy: actorId },
    }),
  ]);
}

export function cascadeDeactivateVille(
  id: string,
  descendants: { communeIds: string[]; quartierIds: string[] },
  actorId: string,
) {
  return prisma.$transaction([
    prisma.ville.update({ where: { id }, data: { status: "INACTIVE", updatedBy: actorId } }),
    prisma.commune.updateMany({
      where: { id: { in: descendants.communeIds } },
      data: { status: "INACTIVE", updatedBy: actorId },
    }),
    prisma.quartier.updateMany({
      where: { id: { in: descendants.quartierIds } },
      data: { status: "INACTIVE", updatedBy: actorId },
    }),
  ]);
}

export function cascadeDeactivateCommune(
  id: string,
  descendants: { quartierIds: string[] },
  actorId: string,
) {
  return prisma.$transaction([
    prisma.commune.update({ where: { id }, data: { status: "INACTIVE", updatedBy: actorId } }),
    prisma.quartier.updateMany({
      where: { id: { in: descendants.quartierIds } },
      data: { status: "INACTIVE", updatedBy: actorId },
    }),
  ]);
}

// --- Option lists, for cascading selects elsewhere ---

// Active only — the Territories create form and the Users assignment
// picker: you should never be attaching something new under an inactive
// row.
export function listActiveProvinces() {
  return prisma.province.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export function listActiveVilles() {
  return prisma.ville.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, provinceId: true },
    orderBy: { name: "asc" },
  });
}

export function listActiveCommunes() {
  return prisma.commune.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, villeId: true },
    orderBy: { name: "asc" },
  });
}

export function listActiveQuartiers() {
  return prisma.quartier.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, communeId: true },
    orderBy: { name: "asc" },
  });
}

// Every status — the Territories edit form: the territory being edited may
// already have an inactive ancestor, which still needs to display (with its
// own status toggle) even though it's not offered as a pick for a
// *different* territory's ancestry.
export function listProvinces() {
  return prisma.province.findMany({
    select: { id: true, name: true, status: true },
    orderBy: { name: "asc" },
  });
}

export function listVilles() {
  return prisma.ville.findMany({
    select: { id: true, name: true, provinceId: true, status: true },
    orderBy: { name: "asc" },
  });
}

export function listCommunes() {
  return prisma.commune.findMany({
    select: { id: true, name: true, villeId: true, status: true },
    orderBy: { name: "asc" },
  });
}
