import type { CreateProductInput, ProductFilters, UpdateProductInput } from "@/lib/schemas/product";
import {
  createPriceHistoryEntry,
  createProduct as createProductRow,
  findProductById,
  findProducts,
  listProductCategories as listProductCategoriesRow,
  type ProductWithCategory,
  updateProduct as updateProductRow,
} from "@/server/repositories/product-repository";

export class DuplicateProductCodeError extends Error {
  constructor() {
    super("A product with this code already exists.");
    this.name = "DuplicateProductCodeError";
  }
}

function isUniqueConstraintViolation(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

function mapUniqueConstraintError(error: unknown): never {
  if (isUniqueConstraintViolation(error)) {
    throw new DuplicateProductCodeError();
  }
  throw error;
}

export type ProductSummary = {
  id: string;
  code: string;
  name: string;
  grossPrice: number;
  netPrice: number;
  status: "ACTIVE" | "INACTIVE";
  category: { id: string; code: string; name: string } | null;
};

function toSummary(product: ProductWithCategory): ProductSummary {
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    grossPrice: Number(product.grossPrice),
    netPrice: Number(product.netPrice),
    status: product.status,
    category: product.category,
  };
}

export async function listProducts(filters: ProductFilters): Promise<ProductSummary[]> {
  const products = await findProducts(filters);
  return products.map(toSummary);
}

export async function getProduct(id: string): Promise<ProductSummary | null> {
  const product = await findProductById(id);
  return product ? toSummary(product) : null;
}

export async function listProductCategories() {
  return listProductCategoriesRow();
}

export async function createProduct(
  input: CreateProductInput,
  actorId: string,
): Promise<ProductSummary> {
  let created: ProductWithCategory;
  try {
    created = await createProductRow({
      code: input.code,
      name: input.name,
      grossPrice: input.grossPrice,
      netPrice: input.netPrice,
      status: "ACTIVE",
      category: input.categoryId ? { connect: { id: input.categoryId } } : undefined,
      createdBy: actorId,
      updatedBy: actorId,
    });
  } catch (error) {
    mapUniqueConstraintError(error);
  }

  await createPriceHistoryEntry({
    product: { connect: { id: created.id } },
    grossPrice: input.grossPrice,
    netPrice: input.netPrice,
    createdBy: actorId,
    updatedBy: actorId,
  });

  return toSummary(created);
}

export async function updateProduct(
  input: UpdateProductInput,
  actorId: string,
): Promise<ProductSummary> {
  const existing = await findProductById(input.id);
  const priceChanged =
    !existing ||
    Number(existing.grossPrice) !== input.grossPrice ||
    Number(existing.netPrice) !== input.netPrice;

  let updated: ProductWithCategory;
  try {
    updated = await updateProductRow(input.id, {
      code: input.code,
      name: input.name,
      grossPrice: input.grossPrice,
      netPrice: input.netPrice,
      category: input.categoryId ? { connect: { id: input.categoryId } } : { disconnect: true },
      ...(input.status ? { status: input.status } : {}),
      updatedBy: actorId,
    });
  } catch (error) {
    mapUniqueConstraintError(error);
  }

  // Only appended when a price actually moved — renaming a product or
  // toggling its status is not a price change, and would otherwise pollute
  // the history with identical duplicate rows.
  if (priceChanged) {
    await createPriceHistoryEntry({
      product: { connect: { id: updated.id } },
      grossPrice: input.grossPrice,
      netPrice: input.netPrice,
      createdBy: actorId,
      updatedBy: actorId,
    });
  }

  return toSummary(updated);
}
