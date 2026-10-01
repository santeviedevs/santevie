import type { UpdateWorkingDaysInput } from "@/lib/schemas/working-day";
import { findActiveHolidayCoveringDate } from "@/server/repositories/holiday-repository";
import { findApprovedLeaveCoveringDate } from "@/server/repositories/leave-repository";
import {
  findWorkingDay,
  listWorkingDays,
  upsertWorkingDay,
  type WorkingDayRow,
} from "@/server/repositories/working-day-repository";

// The single source of truth attendance status derivation (S3-04) consumes
// to know whether a user was expected to work on a given date. Checks, in
// order: the territory's configured weekly working days, any holiday
// (territory-specific or all-territory), and — when userId is given — the
// user's own approved leave. Pending/Rejected leave never affects this.
//
// A territory with no TerritoryWorkingDay rows at all defaults to "working"
// for every day (fail-open) — this should be unreachable in practice, since
// territory-service.ts seeds all 7 rows whenever a Territory is created, but
// isWorkingDay itself must not silently mark every date non-working just
// because the config lookup came back empty.
export async function isWorkingDay(
  date: Date,
  territoryId: string,
  userId?: string,
): Promise<boolean> {
  const dayOfWeek = date.getUTCDay();

  const workingDay = await findWorkingDay(territoryId, dayOfWeek);
  if (workingDay && !workingDay.isWorking) return false;

  const holiday = await findActiveHolidayCoveringDate(territoryId, date);
  if (holiday) return false;

  if (userId) {
    const leave = await findApprovedLeaveCoveringDate(userId, date);
    if (leave) return false;
  }

  return true;
}

export type WorkingDaySummary = { dayOfWeek: number; isWorking: boolean };

export async function getWorkingDays(territoryId: string): Promise<WorkingDaySummary[]> {
  const rows = await listWorkingDays(territoryId);
  return rows.map(toSummary);
}

function toSummary(row: WorkingDayRow): WorkingDaySummary {
  return { dayOfWeek: row.dayOfWeek, isWorking: row.isWorking };
}

export async function updateWorkingDays(
  input: UpdateWorkingDaysInput,
  actorId: string,
): Promise<WorkingDaySummary[]> {
  const updated = await Promise.all(
    input.days.map((day) =>
      upsertWorkingDay(input.territoryId, day.dayOfWeek, day.isWorking, actorId),
    ),
  );
  return updated.map(toSummary).sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}
