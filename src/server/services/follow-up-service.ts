import type { CreateFollowUpInput } from "@/lib/schemas/follow-up";
import {
  completeFollowUpRow,
  createFollowUpRow,
  findFollowUpById,
  findPendingFollowUps,
  findPendingFollowUpsForUser,
  type FollowUpRow,
} from "@/server/repositories/follow-up-repository";
import { getUserScope, type ScopeSession, scopeUserIds } from "@/server/scope";

import {
  ActivityNotAuthorizedError,
  AssignmentNotActionableError,
  AssignmentNotFoundError,
  getAssignmentForAction,
} from "./activity-service";

export type FollowUpSummary = {
  id: string;
  dueDate: Date;
  status: string;
  assignmentId: string;
  activity: {
    id: string;
    name: string;
    type: string;
    center: { id: string; name: string } | null;
    territory: { id: string; code: string } | null;
  };
};

function toSummary(row: FollowUpRow): FollowUpSummary {
  return {
    id: row.id,
    dueDate: row.dueDate,
    status: row.status,
    assignmentId: row.assignment.id,
    activity: row.assignment.activity,
  };
}

// The follow-up belongs to the assignment it's raised against, whoever
// creates it — a manager adding one for their team doesn't take ownership
// of it. The assignment must still be PLANNED: no point raising a follow-up
// against work that's already done or cancelled.
export async function createFollowUp(
  input: CreateFollowUpInput,
  session: ScopeSession,
  canAssign: boolean,
): Promise<FollowUpSummary> {
  const assignment = await getAssignmentForAction(input.assignmentId, session, canAssign);
  if (assignment.status !== "PLANNED") throw new AssignmentNotActionableError();

  const created = await createFollowUpRow({
    assignment: { connect: { id: input.assignmentId } },
    dueDate: new Date(input.dueDate),
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });
  return toSummary(created);
}

// Only the follow-up's own assignee can complete it.
export async function completeFollowUp(id: string, actorId: string): Promise<FollowUpSummary> {
  const followUp = await findFollowUpById(id);
  if (!followUp) throw new AssignmentNotFoundError();
  if (followUp.assignment.userId !== actorId) throw new ActivityNotAuthorizedError();

  const updated = await completeFollowUpRow(id, actorId);
  return toSummary(updated);
}

// "Pending" = not yet done, "overdue" = pending AND past its due date as of
// `asOf` (defaults to now). Split from one underlying query rather than two
// separate repository calls, so the two lists the delegate home-screen
// widget needs (pending, overdue) always agree with each other.
export async function getMyFollowUps(
  userId: string,
  asOf: Date = new Date(),
): Promise<{ pending: FollowUpSummary[]; overdue: FollowUpSummary[] }> {
  const rows = await findPendingFollowUpsForUser(userId);
  const summaries = rows.map(toSummary);
  const overdue = summaries.filter((f) => f.dueDate.getTime() < asOf.getTime());
  return { pending: summaries, overdue };
}

// Scoped team view — same getUserScope/scopeUserIds pattern as every other
// list query.
export async function getTeamOverdueFollowUps(
  session: ScopeSession,
  asOf: Date = new Date(),
): Promise<FollowUpSummary[]> {
  const scope = await getUserScope(session);
  const rows = await findPendingFollowUps(scopeUserIds(scope));
  return rows.map(toSummary).filter((f) => f.dueDate.getTime() < asOf.getTime());
}
