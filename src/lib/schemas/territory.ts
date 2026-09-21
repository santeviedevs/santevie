import { z } from "zod";

// cuid — matches the id format Prisma generates for Province/Ville/Commune/Quartier.
const id = z.string().min(1);

const name = z.string().trim().min(1, "Name is required").max(120);

// A Territory's Province/Ville/Commune is either an existing row (picked
// from the cascading select) or a brand-new one (typed inline) — resolved
// server-side in territory-service.ts's createTerritory/updateTerritoryEntry.
export const ancestorLevelSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("existing"), id }),
  z.object({ mode: z.literal("new"), name }),
]);
export type AncestorLevelInput = z.infer<typeof ancestorLevelSchema>;

export const territoryLevelSchema = z.enum(["province", "ville", "commune", "quartier"]);
export type TerritoryLevel = z.infer<typeof territoryLevelSchema>;

// A Territory is whichever of Province/Ville/Commune/Quartier the admin
// stops filling in at — Ville/Commune/Quartier are all optional, and each
// requires its immediate parent to be present (the same prefix the
// cascading combobox already enforces client-side by disabling a field
// until its parent has a value; re-checked here since that's only ever a
// UI convenience, never something the server can trust on its own).
export const createTerritorySchema = z
  .object({
    province: ancestorLevelSchema,
    ville: ancestorLevelSchema.optional(),
    commune: ancestorLevelSchema.optional(),
    quartierName: name.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.commune && !data.ville) {
      ctx.addIssue({
        code: "custom",
        path: ["ville"],
        message: "Ville is required before Commune.",
      });
    }
    if (data.quartierName && !data.commune) {
      ctx.addIssue({
        code: "custom",
        path: ["commune"],
        message: "Commune is required before Quartier.",
      });
    }

    // The deepest filled-in level must actually be *new* — otherwise
    // nothing would be created (every ancestor already existed, and
    // nothing was added under it).
    const deepestIsNew = data.quartierName
      ? true
      : data.commune
        ? data.commune.mode === "new"
        : data.ville
          ? data.ville.mode === "new"
          : data.province.mode === "new";
    if (!deepestIsNew) {
      ctx.addIssue({
        code: "custom",
        path: ["province"],
        message: "Nothing new to create — type a new name for at least one level.",
      });
    }
  });
export type CreateTerritoryInput = z.infer<typeof createTerritorySchema>;

const status = z.enum(["ACTIVE", "INACTIVE"]);

// Editing never extends a Territory deeper than the level it already is
// (that's what the create form is for) — so `province`/`ville`/`commune`
// here are only the *ancestor* levels strictly above the one being edited
// (reassignable to a different existing row, or a brand-new one), present
// only when relevant to `level`. `name` is always the rename of whichever
// row IS being edited — unlike create, there's no existing/new choice for
// it, since it's the specific row this edit page already loaded.
export const updateTerritorySchema = z
  .object({
    id,
    level: territoryLevelSchema,
    province: ancestorLevelSchema.optional(),
    ville: ancestorLevelSchema.optional(),
    commune: ancestorLevelSchema.optional(),
    name,
    // `status` is always the edited row's own status. `provinceStatus`/
    // `villeStatus`/`communeStatus` toggle an ancestor level further up the
    // chain, same as `status` for Quartier already did — only meaningful
    // when that ancestor's mode is "existing" (a freshly created one has no
    // prior status to toggle away from in this same request).
    status: status.optional(),
    provinceStatus: status.optional(),
    villeStatus: status.optional(),
    communeStatus: status.optional(),
    // Growing the hierarchy *below* the edited row, right from its edit
    // page — e.g. editing a Province can also add a new Ville under it
    // (and, cascading from there, a Commune, and a Quartier) in the same
    // save. Each is only meaningful strictly below `level`: editing a
    // Commune can add a `newQuartierName` directly; editing a Province can
    // add all three, cascading from `newVille`.
    newVille: ancestorLevelSchema.optional(),
    newCommune: ancestorLevelSchema.optional(),
    newQuartierName: name.optional(),
  })
  .superRefine((data, ctx) => {
    const needsProvince = data.level !== "province";
    const needsVille = data.level === "commune" || data.level === "quartier";
    const needsCommune = data.level === "quartier";
    if (needsProvince && !data.province) {
      ctx.addIssue({ code: "custom", path: ["province"], message: "Province is required." });
    }
    if (needsVille && !data.ville) {
      ctx.addIssue({ code: "custom", path: ["ville"], message: "Ville is required." });
    }
    if (needsCommune && !data.commune) {
      ctx.addIssue({ code: "custom", path: ["commune"], message: "Commune is required." });
    }

    // Prefix-consistency for the *new* chain below `level`, same idea as
    // createTerritorySchema — can't add a Commune without a Ville first
    // (when starting from Province), can't add a Quartier without a
    // Commune first.
    if (data.level === "province") {
      if (data.newCommune && !data.newVille) {
        ctx.addIssue({
          code: "custom",
          path: ["newVille"],
          message: "Ville is required before Commune.",
        });
      }
      if (data.newQuartierName && !data.newCommune) {
        ctx.addIssue({
          code: "custom",
          path: ["newCommune"],
          message: "Commune is required before Quartier.",
        });
      }
    }
    if (data.level === "ville" && data.newQuartierName && !data.newCommune) {
      ctx.addIssue({
        code: "custom",
        path: ["newCommune"],
        message: "Commune is required before Quartier.",
      });
    }

    // If anything new is being added below `level`, the deepest one must
    // actually be "new" — otherwise nothing would be added. Mirrors
    // createTerritorySchema's identical check. Absent entirely (no addition
    // attempted at all) is valid — a no-op, not an error.
    function deepestNewIsNew(): boolean {
      if (data.level === "province") {
        if (data.newQuartierName) return true;
        if (data.newCommune) return data.newCommune.mode === "new";
        if (data.newVille) return data.newVille.mode === "new";
        return true;
      }
      if (data.level === "ville") {
        if (data.newQuartierName) return true;
        if (data.newCommune) return data.newCommune.mode === "new";
        return true;
      }
      return true;
    }
    if (!deepestNewIsNew()) {
      ctx.addIssue({
        code: "custom",
        path: ["newVille"],
        message: "Nothing new to add — type a new name for at least one level.",
      });
    }

    // An entity can't be deactivated and grown a new (necessarily active)
    // child in the same save — that child would start out active under a
    // now-inactive parent, exactly the state the whole status cascade
    // exists to prevent.
    const addsSomethingNew = Boolean(data.newVille || data.newCommune || data.newQuartierName);
    if (data.status === "INACTIVE" && addsSomethingNew) {
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message: "Cannot deactivate this and add a new one underneath it in the same save.",
      });
    }
  });
export type UpdateTerritoryInput = z.infer<typeof updateTerritorySchema>;

// The Territories list filter bar: search by a territory's own name at
// whatever level it is, narrow by its Province/Ville/Commune ancestry, and
// status.
export const territoryFiltersSchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  provinceId: z.string().optional(),
  villeId: z.string().optional(),
  communeId: z.string().optional(),
});
export type TerritoryFilters = z.infer<typeof territoryFiltersSchema>;
