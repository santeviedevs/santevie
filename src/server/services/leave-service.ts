import type { PagedResult } from "@/lib/pagination";
import type { ApplyLeaveInput, LeaveFilters } from "@/lib/schemas/leave";
import {
  countFilteredLeaves,
  createLeaveRow,
  findLeaveById,
  findLeaves,
  findOverlappingLeave,
  type LeaveRow,
  updateLeaveRow,
} from "@/server/repositories/leave-repository";
import { findUserById } from "@/server/repositories/user-repository";
import { getUserScope, isWithinScope, type ScopeSession } from "@/server/scope";

export class InactiveRequesterError extends Error {
  constructor() {
    super("Only an active user can apply for leave.");
    this.name = "InactiveRequesterError";
  }
}

export class OverlappingLeaveError extends Error {
  constructor() {
    super("You already have a pending or approved leave request that overlaps these dates.");
    this.name = "OverlappingLeaveError";
  }
}

export class LeaveNotFoundError extends Error {
  constructor() {
    super("Leave request not found.");
    this.name = "LeaveNotFoundError";
  }
}

// Distinct from the coarse `leave:approve` permission check in the Server
// Action — this is the row-level check: is the current user actually an
// ancestor of the requester in the reporting hierarchy? (Or, for Admin
// specifically, deciding their own request — see the self-request branch in
// decideLeave.) Reuses the existing scope helper exactly as visibility (Team
// Leaves) does, rather than a separate "direct manager only" lookup — see
// S3-01 plan. Note the scope helper's "ids" case always includes the
// caller's own id (it also answers "what can I see," which includes your
// own records) — decideLeave must NOT feed a self-request through it
// directly, or a Supervisor/Manager could self-approve, which only Admin is
// authorized to do.
export class NotAuthorizedApproverError extends Error {
  constructor() {
    super("You are not authorized to decide this leave request.");
    this.name = "NotAuthorizedApproverError";
  }
}

export class InvalidLeaveTransitionError extends Error {
  constructor(currentStatus: string) {
    super(`This leave request is already ${currentStatus.toLowerCase()} and cannot be changed.`);
    this.name = "InvalidLeaveTransitionError";
  }
}

export type LeaveSummary = {
  id: string;
  startDate: Date;
  endDate: Date;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decidedBy: string | null;
  decidedAt: Date | null;
  decisionRemark: string | null;
  user: { id: string; name: string; employeeCode: string };
  leaveType: { id: string; name: string };
};

function toSummary(row: LeaveRow): LeaveSummary {
  return {
    id: row.id,
    startDate: row.startDate,
    endDate: row.endDate,
    reason: row.reason,
    status: row.status,
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt,
    decisionRemark: row.decisionRemark,
    user: { id: row.user.id, name: row.user.name, employeeCode: row.user.employeeCode },
    leaveType: row.leaveType,
  };
}

// Only Pending and Approved leave reserve a date range — a Rejected request
// doesn't block a fresh application for the same dates.
const OVERLAP_BLOCKING_STATUSES = ["PENDING", "APPROVED"] as const;

export async function applyLeave(
  input: ApplyLeaveInput,
  requesterId: string,
): Promise<LeaveSummary> {
  const requester = await findUserById(requesterId);
  if (!requester || requester.status !== "ACTIVE") {
    throw new InactiveRequesterError();
  }

  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);

  const overlap = await findOverlappingLeave(
    requesterId,
    startDate,
    endDate,
    OVERLAP_BLOCKING_STATUSES,
  );
  if (overlap) throw new OverlappingLeaveError();

  const created = await createLeaveRow({
    startDate,
    endDate,
    reason: input.reason ?? null,
    status: "PENDING",
    user: { connect: { id: requesterId } },
    leaveType: { connect: { id: input.leaveTypeId } },
    createdBy: requesterId,
    updatedBy: requesterId,
  });
  return toSummary(created);
}

export async function listMyLeaves(
  userId: string,
  filters: LeaveFilters,
): Promise<PagedResult<LeaveSummary>> {
  const [rows, total] = await Promise.all([
    findLeaves(filters, [userId]),
    countFilteredLeaves(filters, [userId]),
  ]);
  return { items: rows.map(toSummary), total, page: filters.page, pageSize: filters.pageSize };
}

// `userIds` is the caller's downstream team (see getDownstreamUserIds in
// src/server/scope.ts, the same helper team/page.tsx already uses) — the
// caller's own id is deliberately excluded, since a person's own requests
// live in My Leaves, not Team Leaves.
//
// filters.employeeId comes straight from the query string, so it's never
// trusted as-is: it's intersected with `userIds` here rather than passed
// through to the repository directly, or a forged employeeId for someone
// outside the caller's downstream team could leak that person's leave
// records (execution plan, section 4: a missed hierarchy filter is a
// breach, not a bug). Not in scope -> empty result set, not "ignore the
// filter and show everyone."
export async function listTeamLeaves(
  userIds: readonly string[],
  filters: LeaveFilters,
): Promise<PagedResult<LeaveSummary>> {
  const scopedUserIds = filters.employeeId
    ? userIds.filter((id) => id === filters.employeeId)
    : userIds;

  const [rows, total] = await Promise.all([
    findLeaves(filters, scopedUserIds),
    countFilteredLeaves(filters, scopedUserIds),
  ]);
  return { items: rows.map(toSummary), total, page: filters.page, pageSize: filters.pageSize };
}

export async function decideLeave(
  leaveId: string,
  decision: "APPROVED" | "REJECTED",
  remark: string | undefined,
  approver: ScopeSession["user"],
): Promise<LeaveSummary> {
  const leave = await findLeaveById(leaveId);
  if (!leave) throw new LeaveNotFoundError();

  if (leave.status !== "PENDING") {
    throw new InvalidLeaveTransitionError(leave.status);
  }

  // Admin has no one above them in the reporting hierarchy, so their own
  // leave is decided by themselves (execution plan: "do not create a fake
  // superior"). Every other role must go through someone else — scope's
  // "ids" case always includes the caller's own id (see the class comment
  // above), so a self-request has to be special-cased here rather than
  // falling through to the generic scope check below.
  if (leave.userId === approver.id) {
    if (approver.roleName !== "ADMIN") {
      throw new NotAuthorizedApproverError();
    }
  } else {
    const scope = await getUserScope({ user: approver });
    if (!isWithinScope(scope, leave.userId)) {
      throw new NotAuthorizedApproverError();
    }
  }

  const updated = await updateLeaveRow(leaveId, {
    status: decision,
    decisionRemark: remark ?? null,
    decidedBy: approver.id,
    decidedAt: new Date(),
    updatedBy: approver.id,
  });
  return toSummary(updated);
}
