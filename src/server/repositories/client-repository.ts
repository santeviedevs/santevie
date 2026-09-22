import type { ClientFilters } from "@/lib/schemas/client";
import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

const listInclude = {
  type: true,
  province: { select: { id: true, name: true } },
  ville: { select: { id: true, name: true } },
  commune: { select: { id: true, name: true } },
  quartier: { select: { id: true, name: true } },
  doctor: {
    include: {
      hospitals: {
        include: {
          hospital: { include: { client: { select: { id: true, name: true, code: true } } } },
        },
      },
    },
  },
  hospital: true,
} satisfies Prisma.ClientInclude;

export type ClientWithRelations = Prisma.ClientGetPayload<{ include: typeof listInclude }>;

function buildWhere(filters: ClientFilters): Prisma.ClientWhereInput {
  return {
    ...(filters.typeId ? { typeId: filters.typeId } : {}),
    ...(filters.quartierId ? { quartierId: filters.quartierId } : {}),
    ...(filters.communeId ? { communeId: filters.communeId } : {}),
    ...(filters.villeId ? { villeId: filters.villeId } : {}),
    ...(filters.provinceId ? { provinceId: filters.provinceId } : {}),
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

export function findClients(filters: ClientFilters): Promise<ClientWithRelations[]> {
  return prisma.client.findMany({
    where: buildWhere(filters),
    include: listInclude,
    orderBy: { name: "asc" },
  });
}

export function findClientById(id: string): Promise<ClientWithRelations | null> {
  return prisma.client.findUnique({ where: { id }, include: listInclude });
}

// Clients selectable for a *new* visit or order — active only. Inactive
// clients must stay out of this list while remaining fully readable via
// findClientById/findClients for history and admin screens.
export function listActiveClientsForSelection() {
  return prisma.client.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, code: true, typeId: true },
    orderBy: { name: "asc" },
  });
}

export function listClientTypes() {
  return prisma.clientType.findMany({ select: { id: true, code: true, name: true } });
}

type ClientCreateData = {
  client: Omit<Prisma.ClientCreateInput, "doctor" | "hospital">;
  doctor?: Omit<Prisma.DoctorCreateWithoutClientInput, never>;
  hospital?: Omit<Prisma.HospitalCreateWithoutClientInput, never>;
};

// A Client and its Doctor/Hospital extension are written in one transaction
// — a failure partway through must never leave a Client row with no
// extension row (or vice versa), since the extension is what makes the
// Client usable as the type it claims to be.
export function createClientWithExtension(data: ClientCreateData): Promise<ClientWithRelations> {
  return prisma.client.create({
    data: {
      ...data.client,
      ...(data.doctor ? { doctor: { create: data.doctor } } : {}),
      ...(data.hospital ? { hospital: { create: data.hospital } } : {}),
    },
    include: listInclude,
  });
}

type ClientUpdateData = {
  client: Omit<Prisma.ClientUpdateInput, "doctor" | "hospital">;
  doctor?: Omit<Prisma.DoctorUpdateWithoutClientInput, never>;
  hospital?: Omit<Prisma.HospitalUpdateWithoutClientInput, never>;
};

export function updateClientWithExtension(
  id: string,
  data: ClientUpdateData,
): Promise<ClientWithRelations> {
  return prisma.client.update({
    where: { id },
    data: {
      ...data.client,
      ...(data.doctor ? { doctor: { update: data.doctor } } : {}),
      ...(data.hospital ? { hospital: { update: data.hospital } } : {}),
    },
    include: listInclude,
  });
}
