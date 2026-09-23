import type { ProductFilters } from "@/lib/schemas/product";
import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

const listInclude = {
  category: { select: { id: true, code: true, name: true } },
} satisfies Prisma.ProductInclude;

export type ProductWithCategory = Prisma.ProductGetPayload<{ include: typeof listInclude }>;

function buildWhere(filters: ProductFilters): Prisma.ProductWhereInput {
  return {
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
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

function buildOrderBy(filters: ProductFilters): Prisma.ProductOrderByWithRelationInput {
  if (filters.sort === "priceAsc") return { netPrice: "asc" };
  if (filters.sort === "priceDesc") return { netPrice: "desc" };
  return { name: "asc" };
}

export function findProducts(filters: ProductFilters): Promise<ProductWithCategory[]> {
  return prisma.product.findMany({
    where: buildWhere(filters),
    include: listInclude,
    orderBy: buildOrderBy(filters),
  });
}

export function findProductById(id: string): Promise<ProductWithCategory | null> {
  return prisma.product.findUnique({ where: { id }, include: listInclude });
}

export function listProductCategories() {
  return prisma.productCategory.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });
}

export function createProduct(data: Prisma.ProductCreateInput): Promise<ProductWithCategory> {
  return prisma.product.create({ data, include: listInclude });
}

export function updateProduct(
  id: string,
  data: Prisma.ProductUpdateInput,
): Promise<ProductWithCategory> {
  return prisma.product.update({ where: { id }, data, include: listInclude });
}

export function createPriceHistoryEntry(
  data: Prisma.ProductPriceHistoryCreateInput,
): Promise<Prisma.ProductPriceHistoryGetPayload<Record<string, never>>> {
  return prisma.productPriceHistory.create({ data });
}
