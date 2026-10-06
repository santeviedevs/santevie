import { z } from "zod";

import { paginationParamsSchema } from "@/lib/pagination";

// cuid — matches the id format Prisma generates for User/LeaveType/Leave.
const id = z.string().min(1);

const startDate = z.iso.date("Enter a valid start date");
const endDate = z.iso.date("Enter a valid end date");

const reason = z.string().trim().max(500).optional();

function checkDateOrder(data: { startDate: string; endDate: string }, ctx: z.RefinementCtx): void {
  if (data.endDate < data.startDate) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "End date cannot be before start date.",
    });
  }
}

// Submitted only through My Leaves → Apply Leave. userId is never accepted
// here — the Server Action always applies leave for the authenticated
// session user, never a value read from the form (see leave-service.ts).
export const applyLeaveSchema = z
  .object({
    leaveTypeId: id,
    startDate,
    endDate,
    reason,
  })
  .superRefine(checkDateOrder);
export type ApplyLeaveInput = z.infer<typeof applyLeaveSchema>;

// Rejection reason is optional — no business rule requires one for this
// story; the approver may still leave a remark on either decision.
export const decideLeaveSchema = z.object({
  leaveId: id,
  decision: z.enum(["APPROVED", "REJECTED"]),
  remark: z.string().trim().max(500).optional(),
});
export type DecideLeaveInput = z.infer<typeof decideLeaveSchema>;

// employeeId/territoryId are only ever populated from Team Leaves — My
// Leaves never renders those filter fields, so they stay undefined there.
// employeeId is still validated against the caller's own downstream scope
// server-side in leave-service.ts's listTeamLeaves, never trusted outright.
export const leaveFiltersSchema = z
  .object({
    leaveTypeId: z.string().optional(),
    status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    employeeId: z.string().optional(),
    territoryId: z.string().optional(),
  })
  .merge(paginationParamsSchema);
export type LeaveFilters = z.infer<typeof leaveFiltersSchema>;
