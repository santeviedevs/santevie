import { z } from "zod";

// cuid — matches the id format Prisma generates for Province/Ville/Commune/
// Quartier/Territory.
const id = z.string().min(1);

const name = z.string().trim().min(1, "Name is required").max(120);

// A Territory's Province/Ville/Commune/Quartier is either an existing row
// (picked from the combobox) or a brand-new one (typed inline) — resolved
// server-side in territory-service.ts. Territory itself has no code field
// here: its `code` is backend-generated, never entered through the UI.
export const ancestorLevelSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("existing"), id }),
  z.object({ mode: z.literal("new"), name }),
]);
export type AncestorLevelInput = z.infer<typeof ancestorLevelSchema>;

// The path a Territory maps to — Province is required, Ville/Commune/
// Quartier are each optional but must be filled in order (no Commune
// without a Ville above it, no Quartier without a Commune above it). Used
// as-is for create, and for edit's "re-point to a different path."
function validatePathPrefix(
  data: { ville?: unknown; commune?: unknown; quartier?: unknown },
  ctx: z.RefinementCtx,
): void {
  if (data.commune && !data.ville) {
    ctx.addIssue({ code: "custom", path: ["ville"], message: "Ville is required before Commune." });
  }
  if (data.quartier && !data.commune) {
    ctx.addIssue({
      code: "custom",
      path: ["commune"],
      message: "Commune is required before Quartier.",
    });
  }
}

export const createTerritorySchema = z
  .object({
    province: ancestorLevelSchema,
    ville: ancestorLevelSchema.optional(),
    commune: ancestorLevelSchema.optional(),
    quartier: ancestorLevelSchema.optional(),
  })
  .superRefine(validatePathPrefix);
export type CreateTerritoryInput = z.infer<typeof createTerritorySchema>;

const status = z.enum(["ACTIVE", "INACTIVE"]);

export const updateTerritorySchema = z
  .object({
    id,
    province: ancestorLevelSchema,
    ville: ancestorLevelSchema.optional(),
    commune: ancestorLevelSchema.optional(),
    quartier: ancestorLevelSchema.optional(),
    status: status.optional(),
  })
  .superRefine(validatePathPrefix);
export type UpdateTerritoryInput = z.infer<typeof updateTerritorySchema>;

// The Territories list filter bar: search by code or any level's name,
// narrow by ancestry, and status.
export const territoryFiltersSchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  provinceId: z.string().optional(),
  villeId: z.string().optional(),
  communeId: z.string().optional(),
});
export type TerritoryFilters = z.infer<typeof territoryFiltersSchema>;
