import { listActiveCentersForTerritories } from "@/server/repositories/center-repository";
import { getPermittedTerritoryIds, type RouteGroupSummary } from "@/server/services/route-service";
import {
  listActiveTerritoryOptions,
  type TerritoryOption,
} from "@/server/services/territory-service";

// Shared between the Plan Routes list page and the dedicated single-route
// page — each route's center picker is scoped to its own territory owner
// (the creator while unassigned, the visitor once assigned), so this has
// to run per-route, not once for the whole page.
export async function enrichRouteForVisits(
  route: RouteGroupSummary,
  allTerritories: TerritoryOption[],
) {
  const territoryOwnerId = route.userId ?? route.createdBy;
  const permittedTerritoryIds = territoryOwnerId
    ? await getPermittedTerritoryIds(territoryOwnerId)
    : new Set<string>();
  const territories = allTerritories.filter((territory) => permittedTerritoryIds.has(territory.id));
  const availableCenters = await listActiveCentersForTerritories([...permittedTerritoryIds]);

  return {
    id: route.id,
    date: route.date ? route.date.toISOString() : null,
    visitorName: route.visitorName,
    editable: route.editable,
    items: route.items,
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

// The brand-new-route page has no route yet to derive a territory owner
// from — it's always scoped to the actor themselves (the eventual creator)
// until assignment says otherwise.
export async function enrichNewRouteDraft(actorId: string, allTerritories: TerritoryOption[]) {
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
