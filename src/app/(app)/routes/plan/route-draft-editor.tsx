"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { type RouteFormState, saveRouteAction } from "../actions";
import { type CenterResult, CenterSearch } from "./center-search";
import { ContactPicker, type LockedContact, type SelectedContact } from "./contact-picker";

type TerritoryOption = { id: string; label: string };

// One center on the draft, with the pending contacts chosen under it and the
// contacts that already have a final status (shown, never editable).
export type DraftCenter = {
  centerId: string;
  name: string;
  code: string;
  typeName: string;
  contacts: SelectedContact[];
  lockedContacts: LockedContact[];
};

// A whole center whose visit already has a final status (completed or
// cancelled) — history on this route, shown beside the draft and never part
// of it.
type ReadOnlyItem = {
  id: string;
  status: "COMPLETED" | "CANCELLED";
  center: { name: string; code: string };
  contacts: { id: string; name: string; code: string; status: string }[];
};

const ANY_TERRITORY = "__any__";

const READONLY_STATUS_VARIANT = {
  COMPLETED: "default",
  CANCELLED: "outline",
} as const;

// The Plan Routes editor — a brand-new route (routeId null) or an existing
// still-editable one. Everything here is local draft state; nothing is
// written until Save runs. COMPLETED/CANCELLED centers and contacts from an
// existing route are shown read-only alongside the draft but are never part
// of what's submitted — the service never touches them regardless.
export function RouteDraftEditor({
  routeId,
  initialCenters,
  readOnlyItems,
  territories,
  dict,
}: {
  routeId: string | null;
  initialCenters: DraftCenter[];
  readOnlyItems: ReadOnlyItem[];
  territories: TerritoryOption[];
  dict: Dictionary["routesPage"];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [centers, setCenters] = useState<DraftCenter[]>(initialCenters);
  const [territoryId, setTerritoryId] = useState(ANY_TERRITORY);

  const centerIdsOnRoute = new Set(centers.map((center) => center.centerId));
  const hasFlaggedContact = centers.some((center) =>
    center.contacts.some((contact) => contact.issue !== null),
  );

  function addCenter(center: CenterResult) {
    setCenters((current) =>
      current.some((entry) => entry.centerId === center.id)
        ? current
        : [
            ...current,
            {
              centerId: center.id,
              name: center.name,
              code: center.code,
              typeName: center.typeName,
              contacts: [],
              lockedContacts: [],
            },
          ],
    );
  }

  function removeCenter(centerId: string) {
    setCenters((current) => current.filter((center) => center.centerId !== centerId));
  }

  function move(index: number, direction: -1 | 1) {
    setCenters((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  function updateContacts(
    centerId: string,
    update: (contacts: SelectedContact[]) => SelectedContact[],
  ) {
    setCenters((current) =>
      current.map((center) =>
        center.centerId === centerId ? { ...center, contacts: update(center.contacts) } : center,
      ),
    );
  }

  function save() {
    setError(null);
    if (hasFlaggedContact) {
      setError(dict.flaggedContactsBlockSave);
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      if (routeId) formData.set("routeId", routeId);
      formData.set(
        "selections",
        JSON.stringify(
          centers.map((center) => ({
            centerId: center.centerId,
            contactIds: center.contacts.map((contact) => contact.contactId),
          })),
        ),
      );
      const result: RouteFormState = await saveRouteAction({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(dict.routeSaved);
      router.push("/routes/plan");
    });
  }

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-border p-4 sm:p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="route-territory">{dict.territoryLabel}</Label>
          <Select
            items={[
              { value: ANY_TERRITORY, label: dict.anyTerritory },
              ...territories.map((t) => ({ value: t.id, label: t.label })),
            ]}
            value={territoryId}
            onValueChange={(value) => setTerritoryId(value ?? ANY_TERRITORY)}
          >
            <SelectTrigger id="route-territory" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="min-w-(--anchor-width)">
              <SelectItem value={ANY_TERRITORY}>{dict.anyTerritory}</SelectItem>
              {territories.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label>{dict.centerSearchLabel}</Label>
          <CenterSearch
            routeId={routeId}
            territoryId={territoryId === ANY_TERRITORY ? null : territoryId}
            excludedCenterIds={centerIdsOnRoute}
            onSelect={addCenter}
            dict={dict}
          />
        </div>
      </div>

      {readOnlyItems.length > 0 ? (
        <ol className="flex flex-col gap-2">
          {readOnlyItems.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-1 rounded-md border border-border px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 break-words">
                  {item.center.name} ({item.center.code})
                </span>
                <Badge variant={READONLY_STATUS_VARIANT[item.status]}>{item.status}</Badge>
              </div>
              {item.contacts.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {item.contacts.map((contact) => `${contact.name} · ${contact.status}`).join(", ")}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      {centers.length === 0 ? (
        <p className="text-sm text-muted-foreground">{dict.noCentersYet}</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {centers.map((center, index) => (
            <li
              key={center.centerId}
              className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="break-words font-semibold">
                    {index + 1}. {center.name}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {center.code}
                    <Badge variant="secondary">{center.typeName}</Badge>
                    <span>
                      {center.contacts.length + center.lockedContacts.length}{" "}
                      {dict.contactsCountSuffix}
                    </span>
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending || index === centers.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={
                      isPending || center.lockedContacts.some((c) => c.status === "COMPLETED")
                    }
                    onClick={() => removeCenter(center.centerId)}
                  >
                    {dict.remove}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">{dict.contactsHeading}</h3>
                <ContactPicker
                  routeId={routeId}
                  centerId={center.centerId}
                  selected={center.contacts}
                  locked={center.lockedContacts}
                  disabled={isPending}
                  onAdd={(contact) =>
                    updateContacts(center.centerId, (contacts) =>
                      contacts.some((entry) => entry.contactId === contact.id)
                        ? contacts
                        : [
                            ...contacts,
                            {
                              contactId: contact.id,
                              name: contact.name,
                              code: contact.code,
                              issue: null,
                            },
                          ],
                    )
                  }
                  onRemove={(contactId) =>
                    updateContacts(center.centerId, (contacts) =>
                      contacts.filter((entry) => entry.contactId !== contactId),
                    )
                  }
                  dict={dict}
                />
              </div>
            </li>
          ))}
        </ol>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="button" onClick={save} disabled={isPending} className="w-fit">
        {isPending ? dict.saving : dict.save}
      </Button>
    </div>
  );
}
