import type { TerritoryFilters } from "@/lib/schemas/territory";
import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

// --- Geography: pure lookups, no code of their own (Territory owns that) ---

export type ProvinceRow = Prisma.ProvinceGetPayload<Record<string, never>>;

export function createProvince(data: Prisma.ProvinceCreateInput): Promise<ProvinceRow> {
  return prisma.province.create({ data });
}

export function findProvinceById(id: string) {
  return prisma.province.findUnique({ where: { id }, select: { id: true, status: true } });
}

export type VilleRow = Prisma.VilleGetPayload<Record<string, never>>;

export function createVille(data: Prisma.VilleCreateInput): Promise<VilleRow> {
  return prisma.ville.create({ data });
}

// Looked up when an "existing" Ville is picked, so the service can confirm
// it actually belongs to the selected Province before trusting it.
export function findVilleById(id: string) {
  return prisma.ville.findUnique({
    where: { id },
    select: { id: true, provinceId: true, status: true },
  });
}

export type CommuneRow = Prisma.CommuneGetPayload<Record<string, never>>;

export function createCommune(data: Prisma.CommuneCreateInput): Promise<CommuneRow> {
  return prisma.commune.create({ data });
}

export function findCommuneById(id: string) {
  return prisma.commune.findUnique({
    where: { id },
    select: { id: true, villeId: true, status: true },
  });
}

export type QuartierRow = Prisma.QuartierGetPayload<Record<string, never>>;

export function createQuartier(data: Prisma.QuartierCreateInput): Promise<QuartierRow> {
  return prisma.quartier.create({ data });
}

export function findQuartierById(id: string) {
  return prisma.quartier.findUnique({
    where: { id },
    select: { id: true, communeId: true, status: true },
  });
}

// --- By-name lookup + upsert (S2-05 territory import: resolves/creates
// geography by name, since import files have no way to reference a
// not-yet-created row by id). Upsert relies on each level's existing
// unique-per-parent name constraint. ---

// Case-insensitive on purpose: spreadsheet data entry is casing-inconsistent
// ("Kinshasa" vs "KINSHASA"), and a case-sensitive match would create a
// duplicate geography row for what is really the same place. The unique
// index behind each of these is still case-sensitive at the database level,
// so if a differently-cased duplicate already exists from before this
// change, `orderBy: createdAt` makes the pick deterministic (oldest wins)
// rather than depending on Postgres's arbitrary row order.
export function findProvinceByName(name: string) {
  return prisma.province.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true, status: true },
    orderBy: { createdAt: "asc" },
  });
}

export function findVilleByName(provinceId: string, name: string) {
  return prisma.ville.findFirst({
    where: { provinceId, name: { equals: name, mode: "insensitive" } },
    select: { id: true, status: true },
    orderBy: { createdAt: "asc" },
  });
}

export function findCommuneByName(villeId: string, name: string) {
  return prisma.commune.findFirst({
    where: { villeId, name: { equals: name, mode: "insensitive" } },
    select: { id: true, status: true },
    orderBy: { createdAt: "asc" },
  });
}

export function findQuartierByName(communeId: string, name: string) {
  return prisma.quartier.findFirst({
    where: { communeId, name: { equals: name, mode: "insensitive" } },
    select: { id: true, status: true },
    orderBy: { createdAt: "asc" },
  });
}

export function upsertProvinceByName(name: string, actorId: string): Promise<ProvinceRow> {
  return prisma.province.upsert({
    where: { name },
    update: {},
    create: { name, createdBy: actorId, updatedBy: actorId },
  });
}

export function upsertVilleByName(
  provinceId: string,
  name: string,
  actorId: string,
): Promise<VilleRow> {
  return prisma.ville.upsert({
    where: { provinceId_name: { provinceId, name } },
    update: {},
    create: {
      name,
      province: { connect: { id: provinceId } },
      createdBy: actorId,
      updatedBy: actorId,
    },
  });
}

export function upsertCommuneByName(
  villeId: string,
  name: string,
  actorId: string,
): Promise<CommuneRow> {
  return prisma.commune.upsert({
    where: { villeId_name: { villeId, name } },
    update: {},
    create: { name, ville: { connect: { id: villeId } }, createdBy: actorId, updatedBy: actorId },
  });
}

export function upsertQuartierByName(
  communeId: string,
  name: string,
  actorId: string,
): Promise<QuartierRow> {
  return prisma.quartier.upsert({
    where: { communeId_name: { communeId, name } },
    update: {},
    create: {
      name,
      commune: { connect: { id: communeId } },
      createdBy: actorId,
      updatedBy: actorId,
    },
  });
}

// Active only — the Territory form's pick-or-create comboboxes at every
// level should never offer building on an inactive geography node.
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

// --- Territory: a specific selected path through the geography above ---

const territoryInclude = {
  province: { select: { id: true, name: true } },
  ville: { select: { id: true, name: true } },
  commune: { select: { id: true, name: true } },
  quartier: { select: { id: true, name: true } },
} satisfies Prisma.TerritoryInclude;

export type TerritoryRow = Prisma.TerritoryGetPayload<{ include: typeof territoryInclude }>;

export function findTerritoryByPathKey(pathKey: string): Promise<TerritoryRow | null> {
  return prisma.territory.findUnique({ where: { pathKey }, include: territoryInclude });
}

export function findTerritoryById(id: string): Promise<TerritoryRow | null> {
  return prisma.territory.findUnique({ where: { id }, include: territoryInclude });
}

export function countTerritories(): Promise<number> {
  return prisma.territory.count();
}

export function createTerritoryRow(data: Prisma.TerritoryCreateInput): Promise<TerritoryRow> {
  return prisma.territory.create({ data, include: territoryInclude });
}

export function updateTerritoryRow(
  id: string,
  data: Prisma.TerritoryUpdateInput,
): Promise<TerritoryRow> {
  return prisma.territory.update({ where: { id }, data, include: territoryInclude });
}

function buildTerritoryWhere(filters: TerritoryFilters): Prisma.TerritoryWhereInput {
  return {
    ...(filters.provinceId ? { provinceId: filters.provinceId } : {}),
    ...(filters.villeId ? { villeId: filters.villeId } : {}),
    ...(filters.communeId ? { communeId: filters.communeId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q
      ? {
          OR: [
            { code: { contains: filters.q, mode: "insensitive" } },
            { province: { name: { contains: filters.q, mode: "insensitive" } } },
            { ville: { name: { contains: filters.q, mode: "insensitive" } } },
            { commune: { name: { contains: filters.q, mode: "insensitive" } } },
            { quartier: { name: { contains: filters.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

export function findTerritories(filters: TerritoryFilters): Promise<TerritoryRow[]> {
  return prisma.territory.findMany({
    where: buildTerritoryWhere(filters),
    include: territoryInclude,
    orderBy: { code: "asc" },
  });
}

// Active only — for the flat Territory picker used by User/Client forms
// and the assignment screen: you should never be assigning someone to a
// Territory that's been deactivated.
export function listActiveTerritories(): Promise<TerritoryRow[]> {
  return prisma.territory.findMany({
    where: { status: "ACTIVE" },
    include: territoryInclude,
    orderBy: { code: "asc" },
  });
}

export async function countTerritoryDependents(
  territoryId: string,
): Promise<{ activeClients: number; activeUsers: number; activeAssignments: number }> {
  const [activeClients, activeUsers, activeAssignments] = await Promise.all([
    prisma.client.count({ where: { territoryId, status: "ACTIVE" } }),
    prisma.user.count({ where: { territoryId, status: "ACTIVE" } }),
    prisma.userTerritoryAssignment.count({ where: { territoryId, user: { status: "ACTIVE" } } }),
  ]);
  return { activeClients, activeUsers, activeAssignments };
}
