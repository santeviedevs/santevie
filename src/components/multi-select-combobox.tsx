"use client";

import { useState } from "react";

import {
  Combobox,
  ComboboxChip,
  ComboboxChipRemove,
  ComboboxChips,
  ComboboxContent,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxTrigger,
} from "@/components/ui/combobox";

export type MultiSelectOption = { id: string; label: string };

// A searchable multi-select over a pre-loaded, bounded options list (same
// "load the whole active list once" convention as centers/territories on
// this form — not a server-side search like SearchCombobox, since these
// lists are admin-maintained and not expected to be large enough to need
// one). Selected items render as removable chips inside the input; typing
// filters the remaining, not-yet-selected options client-side.
export function MultiSelectCombobox({
  id,
  placeholder,
  options,
  value,
  onChange,
  noMatchesLabel,
  disabled,
}: {
  id: string;
  placeholder: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  noMatchesLabel: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");

  const selected = options.filter((o) => value.includes(o.id));
  const byId = new Map(options.map((o) => [o.id, o]));

  const needle = query.trim().toLowerCase();
  const filtered = options.filter(
    (o) => !value.includes(o.id) && (needle === "" || o.label.toLowerCase().includes(needle)),
  );

  return (
    <Combobox
      multiple
      value={value}
      inputValue={query}
      disabled={disabled}
      itemToStringLabel={(itemValue: string) => byId.get(itemValue)?.label ?? ""}
      onInputValueChange={setQuery}
      onValueChange={(next: string[]) => {
        onChange(next);
        setQuery("");
      }}
    >
      <ComboboxInputGroup className="h-auto flex-wrap py-1">
        <ComboboxChips>
          {selected.map((item) => (
            <ComboboxChip key={item.id}>
              {item.label}
              <ComboboxChipRemove
                onClick={(event) => {
                  event.stopPropagation();
                  onChange(value.filter((v) => v !== item.id));
                }}
              />
            </ComboboxChip>
          ))}
        </ComboboxChips>
        <ComboboxInput id={id} placeholder={selected.length === 0 ? placeholder : ""} />
        <ComboboxTrigger />
      </ComboboxInputGroup>
      <ComboboxContent>
        {filtered.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">{noMatchesLabel}</div>
        ) : null}
        {filtered.map((item) => (
          <ComboboxItem key={item.id} value={item.id}>
            {item.label}
          </ComboboxItem>
        ))}
      </ComboboxContent>
    </Combobox>
  );
}
