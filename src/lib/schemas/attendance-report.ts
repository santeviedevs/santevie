import { z } from "zod";

import { paginationParamsSchema } from "@/lib/pagination";

const attendanceStatus = z.enum([
  "PRESENT",
  "LATE",
  "INCOMPLETE",
  "ABSENT",
  "NON_WORKING",
  "NEEDS_REVIEW",
]);

// S3-05's attendance administration screen filters — employee, territory,
// date range and status, same shape used by both the on-screen report and
// the Excel export route handler so neither can drift from the other (the
// export must honor exactly the same filters the screen shows).
export const attendanceReportFiltersSchema = z
  .object({
    employeeId: z.string().optional(),
    territoryId: z.string().optional(),
    dateFrom: z.iso.date().optional(),
    dateTo: z.iso.date().optional(),
    status: attendanceStatus.optional(),
  })
  .merge(paginationParamsSchema);
export type AttendanceReportFilters = z.infer<typeof attendanceReportFiltersSchema>;
