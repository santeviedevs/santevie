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

const DEBOUNCE_MS = 300;

// A single-select combobox whose options come from a bounded, server-side
// GET search (never a preloaded list). Typing is debounced; every query
// aborts the previous request and discards its response (useTypeahead), so a
// slow old answer can never replace a newer one. `value` is the chosen item;
// editing the text after choosing clears it, so the field never shows a label
// that no longer matches the selection. To reset from outside (after a
// successful submit), change the component's `key`.
export function SearchCombobox<T>({
  buildUrl,
  extract,
  getId,
  getLabel,
  renderItem,
  value,
  onChange,
  placeholder,
  emptyLabel,
  loadingLabel,
  errorLabel,
  disabled,
  inputId,
}: {
  buildUrl: (query: string) => string;
  extract: (json: unknown) => T[];
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  value: T | null;
  onChange: (item: T | null) => void;
  placeholder: string;
  emptyLabel: string;
  loadingLabel: string;
  errorLabel: string;
  disabled?: boolean;
  inputId?: string;
}) {
  const [query, setQuery] = useState(value ? getLabel(value) : "");

  // While the text is just the chosen item's own label, search for "" so
  // reopening the list shows options, not only the item already chosen.
  const searchText = value && query === getLabel(value) ? "" : query.trim();
  const { data, status } = useTypeahead<unknown>(
    buildUrl(searchText),
    searchText === "" ? 0 : DEBOUNCE_MS,
  );

  const results = data ? extract(data) : [];
  const byId = new Map(results.map((item) => [getId(item), item]));
  if (value) byId.set(getId(value), value);

  return (
    <Combobox
      value={value ? getId(value) : null}
      inputValue={query}
      onInputValueChange={(next: string) => {
        setQuery(next);
        if (value && next !== getLabel(value)) onChange(null);
      }}
      onValueChange={(id: string | null) => {
        const item = id ? byId.get(id) : undefined;
        if (!item) return;
        setQuery(getLabel(item));
        onChange(item);
      }}
      itemToStringLabel={(id: string) => {
        const item = byId.get(id);
        return item ? getLabel(item) : "";
      }}
      // Results are already filtered on the server, and the root needs the
      // item list for ComboboxEmpty to work (see center-search.tsx).
      items={results.map(getId)}
      filter={null}
      disabled={disabled}
      autoHighlight
    >
      <ComboboxInputGroup>
        <ComboboxInput id={inputId} placeholder={placeholder} />
        <ComboboxTrigger />
      </ComboboxInputGroup>
      <ComboboxContent>
        <ComboboxEmpty>
          {status === "error" ? errorLabel : status === "loading" ? loadingLabel : emptyLabel}
        </ComboboxEmpty>
        {results.map((item) => (
          <ComboboxItem key={getId(item)} value={getId(item)} className="items-start">
            {renderItem(item)}
          </ComboboxItem>
        ))}
      </ComboboxContent>
    </Combobox>
  );
}
