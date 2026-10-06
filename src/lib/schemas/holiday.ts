import { z } from "zod";

import { paginationParamsSchema } from "@/lib/pagination";

// cuid — matches the id format Prisma generates for Territory/Holiday.
const id = z.string().min(1);

const name = z.string().trim().min(1, "Name is required").max(120);

const startDate = z.iso.date("Enter a valid start date");
const endDate = z.iso.date("Enter a valid end date");

const status = z.enum(["ACTIVE", "INACTIVE"]);

function checkDateOrder(data: { startDate: string; endDate: string }, ctx: z.RefinementCtx): void {
  if (data.endDate < data.startDate) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "End date cannot be before start date.",
    });
  }
}

// territoryId absent/undefined means the holiday applies to every
// territory — a single-day holiday is startDate === endDate.
export const createHolidaySchema = z
  .object({
    name,
    startDate,
    endDate,
    territoryId: id.nullish(),
  })
  .superRefine(checkDateOrder);
export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;

export const updateHolidaySchema = z
  .object({
    id,
    name,
    startDate,
    endDate,
    territoryId: id.nullish(),
    status: status.optional(),
  })
  .superRefine(checkDateOrder);
export type UpdateHolidayInput = z.infer<typeof updateHolidaySchema>;

export const holidayFiltersSchema = z
  .object({
    territoryId: z.string().optional(),
    year: z.coerce.number().int().optional(),
    status: status.optional(),
  })
  .merge(paginationParamsSchema);
export type HolidayFilters = z.infer<typeof holidayFiltersSchema>;
