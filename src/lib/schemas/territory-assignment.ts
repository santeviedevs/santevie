import { z } from "zod";

// cuid — matches the id format Prisma generates for User/Territory/
// UserTerritoryAssignment.
const id = z.string().min(1);

export const assignTerritorySchema = z.object({
  userId: id,
  territoryId: id,
});
export type AssignTerritoryInput = z.infer<typeof assignTerritorySchema>;

export const removeTerritoryAssignmentSchema = z.object({ id });
export type RemoveTerritoryAssignmentInput = z.infer<typeof removeTerritoryAssignmentSchema>;
