import { listActiveCentersForTerritories } from "@/server/repositories/center-repository";
import { getPermittedTerritoryIds, type PlanGroupSummary } from "@/server/services/plan-service";
import {
  listActiveTerritoryOptions,
  type TerritoryOption,
} from "@/server/services/territory-service";

// Shared between the Plan Visits list page and the dedicated single-plan
// page — each plan's center picker is scoped to its own territory owner
// (the creator while unassigned, the visitor once assigned), so this has
// to run per-plan, not once for the whole page.
export async function enrichPlanForVisits(
  plan: PlanGroupSummary,
  allTerritories: TerritoryOption[],
) {
  const territoryOwnerId = plan.userId ?? plan.createdBy;
  const permittedTerritoryIds = territoryOwnerId
    ? await getPermittedTerritoryIds(territoryOwnerId)
    : new Set<string>();
  const territories = allTerritories.filter((territory) => permittedTerritoryIds.has(territory.id));
  const availableCenters = await listActiveCentersForTerritories([...permittedTerritoryIds]);

  return {
    id: plan.id,
    date: plan.date ? plan.date.toISOString() : null,
    visitorName: plan.visitorName,
    editable: plan.editable,
    items: plan.items,
    territories: territories.map((territory) => ({ id: territory.id, label: territory.label })),
    availableCenters: availableCenters.map((center) => ({
      id: center.id,
      name: center.name,
      code: center.code,
      territoryId: center.territoryId,
    })),
  };
}

export async function getAllTerritoryOptions(): Promise<TerritoryOption[]> {
  return listActiveTerritoryOptions();
}

// The brand-new-plan page has no plan yet to derive a territory owner
// from — it's always scoped to the actor themselves (the eventual creator)
// until assignment says otherwise.
export async function enrichNewPlanDraft(actorId: string, allTerritories: TerritoryOption[]) {
  const permittedTerritoryIds = await getPermittedTerritoryIds(actorId);
  const territories = allTerritories.filter((territory) => permittedTerritoryIds.has(territory.id));
  const availableCenters = await listActiveCentersForTerritories([...permittedTerritoryIds]);

  return {
    territories: territories.map((territory) => ({ id: territory.id, label: territory.label })),
    availableCenters: availableCenters.map((center) => ({
      id: center.id,
      name: center.name,
      code: center.code,
      territoryId: center.territoryId,
    })),
  };
}
