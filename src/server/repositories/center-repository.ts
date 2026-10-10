import { toSkipTake } from "@/lib/pagination";
import type { CenterFilters } from "@/lib/schemas/center";
import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

const listInclude = {
  type: true,
  territory: {
    select: {
      id: true,
      code: true,
      province: { select: { id: true, name: true } },
      ville: { select: { id: true, name: true } },
      commune: { select: { id: true, name: true } },
      quartier: { select: { id: true, name: true } },
    },
  },
  hospital: true,
} satisfies Prisma.CenterInclude;

export type CenterWithRelations = Prisma.CenterGetPayload<{ include: typeof listInclude }>;

function buildWhere(filters: CenterFilters): Prisma.CenterWhereInput {
  return {
    ...(filters.typeId ? { typeId: filters.typeId } : {}),
    ...(filters.territoryId ? { territoryId: filters.territoryId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.missingCoordinates ? { OR: [{ latitude: null }, { longitude: null }] } : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" } },
            { code: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export function findCenters(filters: CenterFilters): Promise<CenterWithRelations[]> {
  return prisma.center.findMany({
    where: buildWhere(filters),
    include: listInclude,
    orderBy: { name: "asc" },
    ...toSkipTake(filters),
  });
}

export function countCenters(filters: CenterFilters): Promise<number> {
  return prisma.center.count({ where: buildWhere(filters) });
}

export function findCenterById(id: string): Promise<CenterWithRelations | null> {
  return prisma.center.findUnique({ where: { id }, include: listInclude });
}

// Centers selectable for a *new* visit or order — active only. Inactive
// centers must stay out of this list while remaining fully readable via
// findCenterById/findCenters for history and admin screens.
export function listActiveCentersForSelection() {
  return prisma.center.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, code: true, typeId: true },
    orderBy: { name: "asc" },
  });
}

// Server-side type-ahead for the route editor's Center picker — bounded by
// `limit`, active centers only, always inside the given territory ids.
// Matches on name or code, case-insensitively.
export function searchActiveCentersInTerritories(params: {
  territoryIds: string[];
  q: string;
  limit: number;
}) {
  const { territoryIds, q, limit } = params;
  return prisma.center.findMany({
    where: {
      status: "ACTIVE",
      territoryId: { in: territoryIds },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      code: true,
      territoryId: true,
      type: { select: { name: true } },
    },
    orderBy: { name: "asc" },
    take: limit,
  });
}

export function listCenterTypes() {
  return prisma.centerType.findMany({ select: { id: true, code: true, name: true } });
}

type CenterCreateData = {
  center: Omit<Prisma.CenterCreateInput, "hospital">;
  hospital?: Omit<Prisma.HospitalCreateWithoutCenterInput, never>;
};

// A Center and its Hospital extension are written in one transaction
// — a failure partway through must never leave a Center row with no
// extension row (or vice versa), since the extension is what makes the
// Center usable as the type it claims to be.
export function createCenterWithExtension(data: CenterCreateData): Promise<CenterWithRelations> {
  return prisma.center.create({
    data: {
      ...data.center,
      ...(data.hospital ? { hospital: { create: data.hospital } } : {}),
    },
    include: listInclude,
  });
}

type CenterUpdateData = {
  center: Omit<Prisma.CenterUpdateInput, "hospital">;
  hospital?: Omit<Prisma.HospitalUpdateWithoutCenterInput, never>;
};

// `upsert`, not `update` — a plain `update` throws P2025 whenever the
// extension row doesn't already exist, which happens both when a center's
// type is switched (e.g. to Hospital, no extension of the new type yet)
// and for pre-S2-02 seed data that was never given an extension row at all
// for whatever type it's labeled with. `upsert`'s create branch covers both
// cases the same way createCenterWithExtension already does on first
// creation.
export function updateCenterWithExtension(
  id: string,
  data: CenterUpdateData,
): Promise<CenterWithRelations> {
  return prisma.center.update({
    where: { id },
    data: {
      ...data.center,
      ...(data.hospital
        ? {
            hospital: {
              // The cast below is safe: center-service.ts only ever builds
              // this object from plain scalar fields (never a
              // FieldUpdateOperationsInput like `{ increment: 1 }`), so it
              // satisfies the Create shape too — Prisma's Update type is
              // just wider than what's actually ever passed here.
              upsert: {
                create: {
                  ...data.hospital,
                  createdBy: data.hospital.updatedBy,
                } as Prisma.HospitalCreateWithoutCenterInput,
                update: data.hospital,
              },
            },
          }
        : {}),
    },
    include: listInclude,
  });
}
