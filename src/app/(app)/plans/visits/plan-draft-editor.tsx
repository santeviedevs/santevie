"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { type PlanFormState, savePlanAction } from "../actions";

type ClientOption = { id: string; name: string; code: string; territoryId: string | null };
type TerritoryOption = { id: string; label: string };
type ReadOnlyItem = {
  id: string;
  status: "COMPLETED" | "CANCELLED";
  client: { name: string; code: string };
};

const ANY_TERRITORY = "__any__";

const READONLY_STATUS_VARIANT = {
  COMPLETED: "default",
  CANCELLED: "outline",
} as const;

// The Plan Visits editor — a brand-new plan (planId null) or an existing
// still-editable one. Everything here is local draft state; nothing is
// written until Save runs. COMPLETED/CANCELLED items from an existing plan
// are shown read-only alongside the draft but are never part of it — the
// service never touches them regardless of what's in clientIdsInOrder.
export function PlanDraftEditor({
  planId,
  initialClientIds,
  readOnlyItems,
  availableClients,
  territories,
  dict,
}: {
  planId: string | null;
  initialClientIds: string[];
  readOnlyItems: ReadOnlyItem[];
  availableClients: ClientOption[];
  territories: TerritoryOption[];
  dict: Dictionary["plansPage"];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draftClientIds, setDraftClientIds] = useState<string[]>(initialClientIds);
  const [query, setQuery] = useState("");
  const [territoryId, setTerritoryId] = useState(ANY_TERRITORY);

  const clientById = useMemo(
    () => new Map(availableClients.map((client) => [client.id, client])),
    [availableClients],
  );

  const draftClientIdSet = useMemo(() => new Set(draftClientIds), [draftClientIds]);
  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    return availableClients
      .filter((client) => !draftClientIdSet.has(client.id))
      .filter((client) => territoryId === ANY_TERRITORY || client.territoryId === territoryId)
      .filter(
        (client) =>
          q.length === 0 ||
          client.name.toLowerCase().includes(q) ||
          client.code.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [availableClients, draftClientIdSet, territoryId, query]);

  function addClient(clientId: string) {
    setQuery("");
    setDraftClientIds((current) => [...current, clientId]);
  }

  function removeClient(clientId: string) {
    setDraftClientIds((current) => current.filter((id) => id !== clientId));
  }

  function move(index: number, direction: -1 | 1) {
    setDraftClientIds((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      if (planId) formData.set("planId", planId);
      draftClientIds.forEach((clientId) => formData.append("clientIdsInOrder", clientId));
      const result: PlanFormState = await savePlanAction({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(dict.planSaved);
      router.push("/plans/visits");
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border p-4">
      {readOnlyItems.length > 0 ? (
        <ol className="flex flex-col gap-2">
          {readOnlyItems.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
            >
              <span>
                {item.client.name} ({item.client.code})
              </span>
              <Badge variant={READONLY_STATUS_VARIANT[item.status]}>{item.status}</Badge>
            </li>
          ))}
        </ol>
      ) : null}

      {draftClientIds.length === 0 ? (
        <p className="text-sm text-muted-foreground">{dict.noClientsYet}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {draftClientIds.map((clientId, index) => {
            const client = clientById.get(clientId);
            return (
              <li
                key={clientId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <span>
                  {index + 1}. {client ? `${client.name} (${client.code})` : clientId}
                </span>
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
                    disabled={isPending || index === draftClientIds.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isPending}
                    onClick={() => removeClient(clientId)}
                  >
                    {dict.remove}
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select
          items={[
            { value: ANY_TERRITORY, label: dict.anyTerritory },
            ...territories.map((t) => ({ value: t.id, label: t.label })),
          ]}
          value={territoryId}
          onValueChange={(value) => setTerritoryId(value ?? ANY_TERRITORY)}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_TERRITORY}>{dict.anyTerritory}</SelectItem>
            {territories.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Combobox
          value={null}
          inputValue={query}
          onInputValueChange={setQuery}
          onValueChange={(clientId: string | null) => {
            if (clientId) addClient(clientId);
          }}
          itemToStringLabel={(clientId: string) => {
            const client = clientById.get(clientId);
            return client ? `${client.name} (${client.code})` : "";
          }}
          autoHighlight
        >
          <ComboboxInputGroup>
            <ComboboxInput placeholder={dict.searchPlaceholder} />
            <ComboboxTrigger />
          </ComboboxInputGroup>
          <ComboboxContent>
            <ComboboxEmpty>{dict.noMatches}</ComboboxEmpty>
            {filteredClients.map((client) => (
              <ComboboxItem key={client.id} value={client.id}>
                {client.name} ({client.code})
              </ComboboxItem>
            ))}
          </ComboboxContent>
        </Combobox>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="button" onClick={save} disabled={isPending} className="w-fit">
        {isPending ? dict.saving : dict.save}
      </Button>
    </div>
  );
}
