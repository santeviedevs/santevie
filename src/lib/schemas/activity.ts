import { z } from "zod";

const id = z.string().min(1);

const activityType = z.enum(["CAMPAIGN", "EVENT", "OTHER"]);
const activityStatus = z.enum(["PLANNED", "DONE", "CANCELLED"]);

// Exactly one of centerId/territoryId — Prisma has no native constraint for
// this, so it's enforced here, at the server boundary every input must
// cross.
export const createActivitySchema = z
  .object({
    type: activityType,
    date: z.iso.date(),
    centerId: id.nullish(),
    territoryId: id.nullish(),
    notes: z.string().trim().max(2000).nullish(),
  })
  .superRefine((data, ctx) => {
    const hasCenter = Boolean(data.centerId);
    const hasTerritory = Boolean(data.territoryId);
    if (hasCenter === hasTerritory) {
      ctx.addIssue({
        code: "custom",
        path: ["centerId"],
        message: "Choose exactly one: a center or a territory.",
      });
    }
  });
export type CreateActivityInput = z.infer<typeof createActivitySchema>;

// Assign or reassign. The assignee must also be within the manager's
// downstream scope — that's checked in the service, not expressible here.
export const assignActivitySchema = z.object({
  id,
  ownerId: id,
});
export type AssignActivityInput = z.infer<typeof assignActivitySchema>;

export const updateActivityStatusSchema = z.object({
  id,
  status: activityStatus,
});
export type UpdateActivityStatusInput = z.infer<typeof updateActivityStatusSchema>;
