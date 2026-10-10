import { getPermittedTerritoryIds, type RouteGroupSummary } from "@/server/services/route-service";
import {
  listActiveTerritoryOptions,
  type TerritoryOption,
} from "@/server/services/territory-service";

import type { DraftCenter } from "./route-draft-editor";

// Shared between the Plan Routes list page and the dedicated single-route
// page — each route's territory picker is scoped to its own territory owner
// (the creator while unassigned, the visitor once assigned), so this has
// to run per-route, not once for the whole page. Centers and contacts are
// not preloaded at all: the editor searches them server-side on demand.
export async function enrichRouteForVisits(
  route: RouteGroupSummary,
  allTerritories: TerritoryOption[],
) {
  const territoryOwnerId = route.userId ?? route.createdBy;
  const permittedTerritoryIds = territoryOwnerId
    ? await getPermittedTerritoryIds(territoryOwnerId)
    : new Set<string>();
  const territories = allTerritories.filter((territory) => permittedTerritoryIds.has(territory.id));

  return {
    id: route.id,
    code: route.code,
    startDate: route.startDate ? route.startDate.toISOString() : null,
    endDate: route.endDate ? route.endDate.toISOString() : null,
    visitorName: route.visitorName,
    editable: route.editable,
    items: route.items,
    territories: territories.map((territory) => ({ id: territory.id, label: territory.label })),
  };
}

// Splits a saved route into what the editor can change and what is history:
// still-PENDING centers become draft cards (their PENDING contacts editable,
// the rest locked beside them); centers already COMPLETED/CANCELLED stay
// read-only.
export function toEditorState(items: RouteGroupSummary["items"]) {
  const initialCenters: DraftCenter[] = items
    .filter((item) => item.status === "PENDING")
    .map((item) => ({
      centerId: item.center.id,
      name: item.center.name,
      code: item.center.code,
      typeName: item.center.typeName,
      contacts: item.contacts
        .filter((contact) => contact.status === "PENDING")
        .map((contact) => ({
          contactId: contact.contactId,
          name: contact.name,
          code: contact.code,
          issue: contact.issue,
        })),
      lockedContacts: item.contacts
        .filter(
          (contact): contact is typeof contact & { status: "COMPLETED" | "CANCELLED" } =>
            contact.status === "COMPLETED" || contact.status === "CANCELLED",
        )
        .map((contact) => ({
          contactId: contact.contactId,
          name: contact.name,
          code: contact.code,
          status: contact.status,
          issue: contact.issue,
        })),
    }));

  const readOnlyItems = items
    .filter(
      (item): item is typeof item & { status: "COMPLETED" | "CANCELLED" } =>
        item.status === "COMPLETED" || item.status === "CANCELLED",
    )
    .map((item) => ({
      id: item.id,
      status: item.status,
      center: { name: item.center.name, code: item.center.code },
      contacts: item.contacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        code: contact.code,
        status: contact.status,
      })),
    }));

  return { initialCenters, readOnlyItems };
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

  return {
    territories: territories.map((territory) => ({ id: territory.id, label: territory.label })),
  };
}
