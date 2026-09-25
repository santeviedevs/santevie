import { beforeEach, describe, expect, it, vi } from "vitest";

const findProducts = vi.fn();
const findProductById = vi.fn();
const createProduct = vi.fn();
const updateProduct = vi.fn();
const createPriceHistoryEntry = vi.fn();

vi.mock("@/server/repositories/product-repository", () => ({
  findProducts,
  findProductById,
  createProduct,
  updateProduct,
  createPriceHistoryEntry,
  listProductCategories: vi.fn(),
}));

const {
  createProduct: createProductService,
  updateProduct: updateProductService,
  DuplicateProductCodeError,
} = await import("./product-service");

const baseProductRow = (overrides: Record<string, unknown> = {}) => ({
  id: "product-1",
  code: "PRD-1",
  name: "Test Product",
  grossPrice: 3.334,
  netPrice: 3.0,
  status: "ACTIVE",
  category: null,
  ...overrides,
});

const baseInput = {
  code: "PRD-2",
  name: "New Product",
  categoryId: null as string | null,
  grossPrice: 10,
  netPrice: 9,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createProduct", () => {
  it("creates the product and appends a price history entry", async () => {
    createProduct.mockResolvedValueOnce(baseProductRow({ code: "PRD-2", name: "New Product" }));

    const result = await createProductService(baseInput, "actor-1");

    expect(result.code).toBe("PRD-2");
    expect(createPriceHistoryEntry).toHaveBeenCalledWith(
      expect.objectContaining({ grossPrice: 10, netPrice: 9 }),
    );
  });

  it("maps a unique constraint violation to DuplicateProductCodeError", async () => {
    createProduct.mockRejectedValueOnce({ code: "P2002" });

    await expect(createProductService(baseInput, "actor-1")).rejects.toThrow(
      DuplicateProductCodeError,
    );
    expect(createPriceHistoryEntry).not.toHaveBeenCalled();
  });
});

describe("updateProduct", () => {
  it("appends a price history entry when a price changes", async () => {
    findProductById.mockResolvedValueOnce(baseProductRow());
    updateProduct.mockResolvedValueOnce(baseProductRow({ grossPrice: 12, netPrice: 11 }));

    await updateProductService(
      {
        id: "product-1",
        code: "PRD-1",
        name: "Test Product",
        categoryId: null,
        grossPrice: 12,
        netPrice: 11,
      },
      "actor-1",
    );

    expect(createPriceHistoryEntry).toHaveBeenCalledWith(
      expect.objectContaining({ grossPrice: 12, netPrice: 11 }),
    );
  });

  it("does not append a price history entry when neither price changes", async () => {
    findProductById.mockResolvedValueOnce(baseProductRow());
    updateProduct.mockResolvedValueOnce(baseProductRow({ name: "Renamed Product" }));

    await updateProductService(
      {
        id: "product-1",
        code: "PRD-1",
        name: "Renamed Product",
        categoryId: null,
        grossPrice: 3.334,
        netPrice: 3.0,
      },
      "actor-1",
    );

    expect(createPriceHistoryEntry).not.toHaveBeenCalled();
  });
});
