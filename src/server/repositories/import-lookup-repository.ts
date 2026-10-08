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
