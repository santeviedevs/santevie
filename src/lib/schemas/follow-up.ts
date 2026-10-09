import { z } from "zod";

const id = z.string().min(1);

export const createFollowUpSchema = z.object({
  activityId: id,
  dueDate: z.iso.date(),
});
export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>;

export const completeFollowUpSchema = z.object({
  id,
});
export type CompleteFollowUpInput = z.infer<typeof completeFollowUpSchema>;
