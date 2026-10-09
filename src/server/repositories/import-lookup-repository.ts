import { prisma } from "@/server/db";

// Every by-code lookup the three importers need to resolve a foreign key
// typed as a human-readable code in a spreadsheet cell into the id Prisma
// actually stores. Centralized here rather than scattered across each
// entity's own repository, since these only exist for import.

export function findCenterTypeByCode(code: string) {
  return prisma.centerType.findUnique({ where: { code } });
}

export function findProductCategoryByCode(code: string) {
  return prisma.productCategory.findUnique({ where: { code } });
}

// Center import references an existing Territory by its own auto-generated
// code (e.g. "TER-00013") — never creates one implicitly, same as
// centerType/category. Only the dedicated territory importer creates new
// territories, resolving/creating geography by name instead.
export function findTerritoryByCode(code: string) {
  return prisma.territory.findUnique({ where: { code }, select: { id: true } });
}

export function findCenterByCode(code: string) {
  return prisma.center.findUnique({ where: { code }, select: { id: true, code: true } });
}

export function findProductByCode(code: string) {
  return prisma.product.findUnique({ where: { code }, select: { id: true, code: true } });
}
