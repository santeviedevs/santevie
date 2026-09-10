import { z } from "zod";

const code = z
  .string()
  .trim()
  .min(2, "Territory code is required")
  .max(32, "Territory code must be 32 characters or fewer");

const name = z.string().trim().min(1, "Name is required").max(120);

// cuid — matches the id format Prisma generates for Territory.
const id = z.string().min(1);

export const createTerritorySchema = z.object({
  code,
  name,
});

export type CreateTerritoryInput = z.infer<typeof createTerritorySchema>;

export const updateTerritorySchema = createTerritorySchema.extend({
  id,
});

export type UpdateTerritoryInput = z.infer<typeof updateTerritorySchema>;

export const territoryFiltersSchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export type TerritoryFilters = z.infer<typeof territoryFiltersSchema>;
