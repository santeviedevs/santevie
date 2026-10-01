import { z } from "zod";

// cuid — matches the id format Prisma generates for Territory.
const id = z.string().min(1);

const workingDayEntry = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isWorking: z.boolean(),
});

// One entry per day of the week (0 = Sunday .. 6 = Saturday, matching
// Date#getUTCDay(), so working-day-service.ts needs no translation layer).
export const updateWorkingDaysSchema = z.object({
  territoryId: id,
  days: z.array(workingDayEntry).length(7, "All seven days must be included"),
});
export type UpdateWorkingDaysInput = z.infer<typeof updateWorkingDaysSchema>;
