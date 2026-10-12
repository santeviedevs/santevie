import { z } from "zod";

const id = z.string().min(1);

// Scoped to one assignment, not the bare activity: with several people
// possibly assigned to the same activity, a follow-up belongs to whichever
// assignment it was raised against.
export const createFollowUpSchema = z.object({
  assignmentId: id,
  dueDate: z.iso.date(),
});
export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>;

export const completeFollowUpSchema = z.object({
  id,
});
export type CompleteFollowUpInput = z.infer<typeof completeFollowUpSchema>;
