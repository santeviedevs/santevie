import type { PagedResult } from "@/lib/pagination";
import type { CreateHolidayInput, HolidayFilters, UpdateHolidayInput } from "@/lib/schemas/holiday";
import {
  countFilteredHolidays,
  createHolidayRow,
  findHolidayById,
  findHolidays,
  type HolidayRow,
  updateHolidayRow,
} from "@/server/repositories/holiday-repository";

export type HolidaySummary = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: "ACTIVE" | "INACTIVE";
  territory: { id: string; code: string } | null;
};

function toSummary(row: HolidayRow): HolidaySummary {
  return {
    id: row.id,
    name: row.name,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    territory: row.territory,
  };
}

export async function getHoliday(id: string): Promise<HolidaySummary | null> {
  const row = await findHolidayById(id);
  return row ? toSummary(row) : null;
}

export async function listHolidays(filters: HolidayFilters): Promise<PagedResult<HolidaySummary>> {
  const [rows, total] = await Promise.all([findHolidays(filters), countFilteredHolidays(filters)]);
  return { items: rows.map(toSummary), total, page: filters.page, pageSize: filters.pageSize };
}

// endDate >= startDate is already enforced at the Zod boundary
// (createHolidaySchema/updateHolidaySchema), so this just persists — unlike
// Territory, nothing else references a Holiday row, so deactivation needs no
// "in use" guard.
export async function createHoliday(
  input: CreateHolidayInput,
  actorId: string,
): Promise<HolidaySummary> {
  const created = await createHolidayRow({
    name: input.name,
    startDate: new Date(input.startDate),
    endDate: new Date(input.endDate),
    territory: input.territoryId ? { connect: { id: input.territoryId } } : undefined,
    createdBy: actorId,
    updatedBy: actorId,
  });
  return toSummary(created);
}

export async function updateHoliday(
  input: UpdateHolidayInput,
  actorId: string,
): Promise<HolidaySummary> {
  const updated = await updateHolidayRow(input.id, {
    name: input.name,
    startDate: new Date(input.startDate),
    endDate: new Date(input.endDate),
    territory: input.territoryId ? { connect: { id: input.territoryId } } : { disconnect: true },
    ...(input.status ? { status: input.status } : {}),
    updatedBy: actorId,
  });
  return toSummary(updated);
}
