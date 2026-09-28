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

  // Resyncs the displayed text whenever `value` changes for a reason other
  // than this component's own selection below (Clear filters, browser
  // back/forward, another filter's navigation) — without this, the field
  // shows whatever it last had locally instead of the actual current
  // selection. Set during render rather than in an effect (React's
  // documented "adjusting state when a prop changes" pattern) — it bails
  // out and re-renders before the browser paints, avoiding a stale frame.
  // Safe to key on `value` alone: unlike a free-typed search box, `value`
  // only ever changes on an actual selection, never while the user is
  // mid-typing to filter the dropdown's own options.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setQuery(selected ? optionText(selected) : "");
  }

  // Reopening the dropdown on an already-made, untouched selection should
  // browse the full list again, not stay narrowed to just that one match —
  // otherwise there'd be no way to pick something else without first
  // clearing the field. Detected by comparing the field's text to the
  // current selection's formatted text rather than clearing it on open:
  // clearing would race the parent's async URL round-trip (the new
  // selection wouldn't be reflected in `value`/`selected` yet if the popup
  // closes before that completes). The moment the user actually types
  // anything, `query` no longer matches and normal filtering resumes.
  const [open, setOpen] = useState(false);
  const showFullListOnReopen = open && selected !== null && query === optionText(selected);

  const trimmed = query.trim();
  const filtered =
    trimmed && !showFullListOnReopen
      ? options.filter((o) => optionText(o).toLowerCase().includes(trimmed.toLowerCase()))
      : options;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Combobox
        value={value}
        inputValue={query}
        disabled={disabled}
        onOpenChange={setOpen}
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
