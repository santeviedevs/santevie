"use client";

import { useState } from "react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { useTypeahead } from "@/lib/hooks/use-typeahead";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { ROUTE_SEARCH_LIMIT } from "@/lib/schemas/route";

export type CenterResult = {
  id: string;
  name: string;
  code: string;
  territoryId: string | null;
  typeName: string;
  territoryPath: string;
};

const DEBOUNCE_MS = 300;

// Server-side Center search: nothing is preloaded, every keystroke (after a
// debounce) asks /api/routes/centers for at most ROUTE_SEARCH_LIMIT
// matches inside the chosen territory. Centers already on the route are
// filtered out of the results here, so one can't be picked twice.
export function CenterSearch({
  routeId,
  territoryId,
  excludedCenterIds,
  onSelect,
  dict,
}: {
  routeId: string | null;
  territoryId: string | null;
  excludedCenterIds: Set<string>;
  onSelect: (center: CenterResult) => void;
  dict: Dictionary["routesPage"];
}) {
  const [query, setQuery] = useState("");

  const params = new URLSearchParams({ q: query.trim() });
  if (territoryId) params.set("territoryId", territoryId);
  if (routeId) params.set("routeId", routeId);
  const { data, status } = useTypeahead<{ centers: CenterResult[] }>(
    `/api/routes/centers?${params.toString()}`,
    query.trim() === "" ? 0 : DEBOUNCE_MS,
  );

  const results = (data?.centers ?? []).filter((center) => !excludedCenterIds.has(center.id));
  const byId = new Map(results.map((center) => [center.id, center]));

  return (
    <Combobox
      value={null}
      inputValue={query}
      onInputValueChange={setQuery}
      onValueChange={(centerId: string | null) => {
        const center = centerId ? byId.get(centerId) : undefined;
        if (!center) return;
        setQuery("");
        onSelect(center);
      }}
      itemToStringLabel={(centerId: string) => {
        const center = byId.get(centerId);
        return center ? `${center.name} (${center.code})` : "";
      }}
      // ComboboxEmpty only works when the root knows the item list — without
      // `items` it always thinks the list is empty and always shows its
      // message. The results are already filtered server-side, so no
      // client-side filter on top (filter={null}).
      items={results.map((center) => center.id)}
      filter={null}
      autoHighlight
    >
      <ComboboxInputGroup>
        <ComboboxInput placeholder={dict.searchPlaceholder} />
        <ComboboxTrigger />
      </ComboboxInputGroup>
      <ComboboxContent>
        <ComboboxEmpty>
          {status === "error"
            ? dict.searchFailed
            : status === "loading"
              ? dict.searching
              : dict.noMatches}
        </ComboboxEmpty>
        {results.map((center) => (
          <ComboboxItem key={center.id} value={center.id} className="items-start">
            <span className="flex min-w-0 flex-col">
              <span className="break-words">{center.name}</span>
              <span className="text-xs text-muted-foreground">
                {[center.code, center.typeName, center.territoryPath].filter(Boolean).join(" · ")}
              </span>
            </span>
          </ComboboxItem>
        ))}
        {data && data.centers.length >= ROUTE_SEARCH_LIMIT ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">{dict.showingFirstResults}</p>
        ) : null}
      </ComboboxContent>
    </Combobox>
  );
}
