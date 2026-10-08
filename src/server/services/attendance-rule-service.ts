import type { CreateAttendanceRuleInput } from "@/lib/schemas/attendance-rule";
import {
  type AttendanceRuleListRow,
  type AttendanceRuleRow,
  createAttendanceRuleRow,
  findCandidateRules,
  listAttendanceRules as listAttendanceRuleRows,
} from "@/server/repositories/attendance-rule-repository";
import { listAssignmentsForUser } from "@/server/repositories/territory-assignment-repository";
import { getDownstreamUserIds, getUpstreamManagerIds } from "@/server/scope";

import type { Prisma } from "../../../generated/prisma/client";

// The global/admin default — what resolveAttendanceThresholds falls back to
// when no territory, team, or individual rule exists yet for a delegate.
// Not stored as a row; a fresh environment with zero AttendanceRule rows
// must still produce a usable result (fail-open to a sane default, same
// reasoning as isWorkingDay's "no TerritoryWorkingDay rows" fallback).
const GLOBAL_DEFAULT_THRESHOLDS = {
  expectedStartMinutes: 9 * 60,
  lateGraceMinutes: 15,
  minimumWorkedMinutes: 240,
};

export type ResolvedAttendanceThresholds = {
  expectedStartMinutes: number;
  lateGraceMinutes: number;
  minimumWorkedMinutes: number;
  source: "individual" | "territory" | "team" | "global";
};

function scopeOf(rule: AttendanceRuleRow): "individual" | "territory" | "team" {
  if (rule.targetUserId) return "individual";
  if (rule.territoryId) return "territory";
  return "team";
}

// The resolution algorithm locked in for S3-04: gather every rule version
// that could apply to `delegateId` (individual override, their assigned
// territory/territories, any manager above them in the chain, or the global
// default), discard anything created after `businessDate` (it didn't exist
// yet as of that date, so it can't have governed it), and take the single
// most-recently-created survivor. Recency wins regardless of scope type or
// which role created it — an individual override, a team rule, and a
// territory rule are just candidates in one pool.
//
// Filtering by createdAt <= businessDate (not "latest overall") is what
// guarantees re-running this for a past date is unaffected by a rule
// created later — the whole point of making AttendanceRule insert-only
// rather than updated in place.
export async function resolveAttendanceThresholds(
  delegateId: string,
  businessDate: Date,
): Promise<ResolvedAttendanceThresholds> {
  const [assignments, upstreamOwnerIds] = await Promise.all([
    listAssignmentsForUser(delegateId),
    getUpstreamManagerIds(delegateId),
  ]);
  const territoryIds = assignments.map((assignment) => assignment.territoryId);

  const candidates = await findCandidateRules({
    targetUserId: delegateId,
    territoryIds,
    ownerIds: upstreamOwnerIds,
  });

  const winner = candidates.find((rule) => rule.createdAt.getTime() <= businessDate.getTime());

  if (!winner) {
    return { ...GLOBAL_DEFAULT_THRESHOLDS, source: "global" };
  }

  return {
    expectedStartMinutes: winner.expectedStartMinutes,
    lateGraceMinutes: winner.lateGraceMinutes,
    minimumWorkedMinutes: winner.minimumWorkedMinutes,
    source: scopeOf(winner),
  };
}

export class AttendanceRuleScopeError extends Error {
  constructor() {
    super("You can only set attendance rules within your own downstream team.");
    this.name = "AttendanceRuleScopeError";
  }
}

// Write-side authorization: territory scope follows the existing
// working-days:manage precedent (any permission holder may set it — no
// further restriction, same as src/app/(app)/admin/territories/[id]/
// working-days/actions.ts). Team scope needs no check at all — its owner is
// always the actor themselves (see createAttendanceRule below), never a
// client-supplied id, so there's nothing to authorize. Individual scope is
// the one that's hierarchy-bound: an ADMIN may target anyone; a
// MANAGER/SUPERVISOR may only target themselves or someone in their own
// downstream reporting chain, per the user's explicit decision ("anyone can
// set this for a particular [person], but it should be under its downstream
// team").
async function assertScopeAuthorized(
  input: CreateAttendanceRuleInput,
  actorId: string,
  actorRoleName: string,
): Promise<void> {
  if (actorRoleName === "ADMIN") return;
  if (input.scope !== "individual") return;

  if (input.targetUserId === actorId) return;

  const downstream = await getDownstreamUserIds(actorId);
  if (!downstream.includes(input.targetUserId)) {
    throw new AttendanceRuleScopeError();
  }
}

export async function createAttendanceRule(
  input: CreateAttendanceRuleInput,
  actorId: string,
  actorRoleName: string,
): Promise<AttendanceRuleRow> {
  await assertScopeAuthorized(input, actorId, actorRoleName);

  const data: Prisma.AttendanceRuleCreateInput = {
    expectedStartMinutes: input.expectedStartMinutes,
    lateGraceMinutes: input.lateGraceMinutes,
    minimumWorkedMinutes: input.minimumWorkedMinutes,
    createdBy: actorId,
    updatedBy: actorId,
    ...(input.scope === "territory" && { territory: { connect: { id: input.territoryId } } }),
    // Always the actor themselves — never a client-supplied id, per the
    // "no picker, implicitly my own team" design.
    ...(input.scope === "team" && { owner: { connect: { id: actorId } } }),
    ...(input.scope === "individual" && {
      targetUser: { connect: { id: input.targetUserId } },
    }),
  };

  return createAttendanceRuleRow(data);
}

export type AttendanceRuleSummary = {
  id: string;
  scope: "individual" | "territory" | "team";
  territory: { id: string; code: string } | null;
  owner: { id: string; name: string } | null;
  targetUser: { id: string; name: string } | null;
  expectedStartMinutes: number;
  lateGraceMinutes: number;
  minimumWorkedMinutes: number;
  createdByName: string | null;
  createdAt: Date;
};

function toSummary(row: AttendanceRuleListRow): AttendanceRuleSummary {
  return {
    id: row.id,
    scope: row.targetUserId ? "individual" : row.territoryId ? "territory" : "team",
    territory: row.territory,
    owner: row.owner,
    targetUser: row.targetUser,
    expectedStartMinutes: row.expectedStartMinutes,
    lateGraceMinutes: row.lateGraceMinutes,
    minimumWorkedMinutes: row.minimumWorkedMinutes,
    createdByName: null,
    createdAt: row.createdAt,
  };
}

// The list screen's scoping: ADMIN sees every rule ever created. A
// MANAGER/SUPERVISOR sees only rules relevant to their own downstream
// reach — territory rules for territories any of their reports are assigned
// to, team/individual rules they or someone below them created or targets.
// DELEGATE never reaches this (gated by attendance-rules:manage itself).
export async function listAttendanceRulesForViewer(
  viewerId: string,
  viewerRoleName: string,
): Promise<AttendanceRuleSummary[]> {
  if (viewerRoleName === "ADMIN") {
    const rows = await listAttendanceRuleRows({});
    return rows.map(toSummary);
  }

  const downstream = await getDownstreamUserIds(viewerId);
  const relevantUserIds = [viewerId, ...downstream];

  const assignmentLists = await Promise.all(relevantUserIds.map(listAssignmentsForUser));
  const territoryIds = [
    ...new Set(assignmentLists.flat().map((assignment) => assignment.territoryId)),
  ];

  const rows = await listAttendanceRuleRows({
    OR: [
      { ownerId: { in: relevantUserIds } },
      { targetUserId: { in: relevantUserIds } },
      ...(territoryIds.length > 0 ? [{ territoryId: { in: territoryIds } }] : []),
    ],
  });
  return rows.map(toSummary);
}
