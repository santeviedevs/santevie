"use client";

import { useState } from "react";

import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";

export type TerritoryPickerOption = { id: string; code: string; label: string };

const CLEAR = "__clear__";

function optionText(option: TerritoryPickerOption): string {
  return option.label ? `${option.code} — ${option.label}` : option.code;
}

// A single searchable picker over existing Territory rows — replaces the
// old 4-level cascading selector everywhere except the Territories admin
// form itself (territory-combo-fields.tsx), which still builds, and can
// create, a path. Territory is now a flat, pre-resolved entity to pick.
export function TerritoryPicker({
  id,
  label,
  placeholder,
  clearLabel,
  noResultsLabel,
  options,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  placeholder: string;
  clearLabel: string;
  noResultsLabel: string;
  options: TerritoryPickerOption[];
  value: string | null;
  onChange: (territoryId: string | null) => void;
  disabled?: boolean;
}) {
  const selected = options.find((o) => o.id === value) ?? null;
  const [query, setQuery] = useState(selected ? optionText(selected) : "");

  const trimmed = query.trim();
  const filtered = trimmed
    ? options.filter((o) => optionText(o).toLowerCase().includes(trimmed.toLowerCase()))
    : options;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Combobox
        value={value}
        inputValue={query}
        disabled={disabled}
        autoHighlight
        itemToStringLabel={(itemValue) => {
          if (itemValue === CLEAR) return "";
          const option = options.find((o) => o.id === itemValue);
          return option ? optionText(option) : "";
        }}
        onInputValueChange={setQuery}
        onValueChange={(next) => {
          if (!next || next === CLEAR) {
            onChange(null);
            setQuery("");
            return;
          }
          onChange(next);
          const option = options.find((o) => o.id === next);
          setQuery(option ? optionText(option) : "");
        }}
      >
        <ComboboxInputGroup>
          <ComboboxInput id={id} placeholder={placeholder} />
          <ComboboxTrigger />
        </ComboboxInputGroup>
        <ComboboxContent>
          <ComboboxItem value={CLEAR}>{clearLabel}</ComboboxItem>
          {filtered.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">{noResultsLabel}</div>
          ) : (
            filtered.map((option) => (
              <ComboboxItem key={option.id} value={option.id}>
                {optionText(option)}
              </ComboboxItem>
            ))
          )}
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
