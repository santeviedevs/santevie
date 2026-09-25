import { z } from "zod";

// cuid — matches the id format Prisma generates for User/Province/Ville/
// Commune/Quartier/UserTerritoryAssignment.
const id = z.string().min(1);

// Submitted the same way CascadingTerritoryFields already produces a
// TerritoryValue: as the admin narrows down, every ancestor level above the
// one they stop at is also set (e.g. picking a Ville also carries the
// Province it belongs to). The server only persists the deepest one — see
// territory-assignment-service.ts — so this schema just requires that at
// least one level was picked, not exactly one.
export const assignTerritorySchema = z
  .object({
    userId: id,
    provinceId: id.nullish(),
    villeId: id.nullish(),
    communeId: id.nullish(),
    quartierId: id.nullish(),
  })
  .refine((data) => Boolean(data.provinceId || data.villeId || data.communeId || data.quartierId), {
    message: "Select a territory to assign.",
    path: ["provinceId"],
  });
export type AssignTerritoryInput = z.infer<typeof assignTerritorySchema>;

export const removeTerritoryAssignmentSchema = z.object({ id });
export type RemoveTerritoryAssignmentInput = z.infer<typeof removeTerritoryAssignmentSchema>;
