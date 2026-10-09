import { z } from "zod";

import { paginationParamsSchema } from "@/lib/pagination";

// cuid — matches the id format Prisma generates for ProductCategory/Product.
const id = z.string().min(1);

const code = z
  .string()
  .trim()
  .min(2, "Code is required")
  .max(32, "Code must be 32 characters or fewer");

const name = z.string().trim().min(1, "Name is required").max(160);

// Both stored as-is from the price list (P. Gros / net-after-discount),
// not netPrice derived from grossPrice × a percentage — see the comment on
// the Product model. netPrice can never exceed grossPrice: it's the
// discounted figure by definition.
const grossPrice = z.number().positive("Gross price must be greater than zero");
const netPrice = z.number().positive("Net price must be greater than zero");
const quantityPerCarton = z
  .number()
  .int("Quantity per carton must be a whole number")
  .positive("Quantity per carton must be greater than zero");

// Applies regardless of whether netPrice was typed directly or derived from
// the form's discount % helper — the 10% cap is a business rule on the
// stored price relationship, not on that helper input.
const MAX_DISCOUNT_RATIO = 0.1;
function checkDiscountCap(data: { grossPrice: number; netPrice: number }, ctx: z.RefinementCtx) {
  if (data.netPrice > data.grossPrice) {
    ctx.addIssue({
      code: "custom",
      path: ["netPrice"],
      message: "Net price cannot be greater than gross price.",
    });
    return;
  }
  if (data.netPrice < data.grossPrice * (1 - MAX_DISCOUNT_RATIO)) {
    ctx.addIssue({
      code: "custom",
      path: ["netPrice"],
      message: "Can't enter discount more than 10%.",
    });
  }
}

export const createProductSchema = z
  .object({
    code,
    name,
    categoryId: id.nullish(),
    grossPrice,
    netPrice,
    quantityPerCarton,
  })
  .superRefine(checkDiscountCap);
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z
  .object({
    id,
    code,
    name,
    categoryId: id.nullish(),
    grossPrice,
    netPrice,
    quantityPerCarton,
    // Absent means "leave as-is"; present is an explicit set, same
    // convention as UpdateCenterInput/UpdateUserInput's status.
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  })
  .superRefine(checkDiscountCap);
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// Sorts by netPrice — the actual charged price, not the reference gross
// price — since that's what "cheapest"/"most expensive" means to whoever
// is browsing the catalogue. Absent means the default (name, A–Z).
export const productSortSchema = z.enum(["priceAsc", "priceDesc"]);
export type ProductSort = z.infer<typeof productSortSchema>;

export const productFiltersSchema = z
  .object({
    q: z.string().trim().optional(),
    categoryId: z.string().optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    sort: productSortSchema.optional(),
  })
  .merge(paginationParamsSchema);
export type ProductFilters = z.infer<typeof productFiltersSchema>;
