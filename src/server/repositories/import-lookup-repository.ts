import { prisma } from "@/server/db";

// Every by-code lookup the three importers need to resolve a foreign key
// typed as a human-readable code in a spreadsheet cell into the id Prisma
// actually stores. Centralized here rather than scattered across each
// entity's own repository, since these only exist for import.

export function findClientTypeByCode(code: string) {
  return prisma.clientType.findUnique({ where: { code } });
}

export function findProductCategoryByCode(code: string) {
  return prisma.productCategory.findUnique({ where: { code } });
}

// Client import references an existing Territory by its own auto-generated
// code (e.g. "TER-00013") — never creates one implicitly, same as
// clientType/category. Only the dedicated territory importer creates new
// territories, resolving/creating geography by name instead.
export function findTerritoryByCode(code: string) {
  return prisma.territory.findUnique({ where: { code }, select: { id: true } });
}

export function findClientByCode(code: string) {
  return prisma.client.findUnique({ where: { code }, select: { id: true, code: true } });
}

export function findProductByCode(code: string) {
  return prisma.product.findUnique({ where: { code }, select: { id: true, code: true } });
}

// Resolves a Doctor's `hospitalCodes` column (S2-05: the many-to-many
// link) — each code is a Client's own code, but DoctorHospital points at
// Hospital.id, not Client.id, so this returns both to tell "code matched a
// client that isn't a Hospital" apart from "code matched nothing at all".
export function findHospitalLookupByClientCodes(codes: string[]) {
  return prisma.client.findMany({
    where: { code: { in: codes } },
    select: { code: true, hospital: { select: { id: true } } },
  });
}
