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

export type CreatableOption = { id: string; label: string };

const CREATE = "__create__";

// A searchable combobox that can also add a new value when the typed text
// matches nothing — e.g. "Select or add new type". `onCreate` persists the
// value and resolves to the new option (or null on failure, after
// surfacing its own error); omit it for a plain searchable select.
export function CreatableCombobox({
  id,
  placeholder,
  options,
  value,
  onChange,
  onCreate,
  addLabel,
  noMatchesLabel,
  disabled,
}: {
  id: string;
  placeholder: string;
  options: CreatableOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  onCreate?: (name: string) => Promise<CreatableOption | null>;
  addLabel?: string;
  noMatchesLabel: string;
  disabled?: boolean;
}) {
  const selected = options.find((o) => o.id === value) ?? null;
  const [query, setQuery] = useState(selected?.label ?? "");

  // Resync the text when `value` changes for a reason other than typing in
  // this field (form reset, the parent clearing it after an "Add") — set
  // during render, same "adjust state when a prop changes" pattern as
  // TerritoryPicker.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setQuery(selected?.label ?? "");
  }

  const [open, setOpen] = useState(false);
  const showFullListOnReopen = open && selected !== null && query === selected.label;

  const trimmed = query.trim();
  const needle = trimmed.toLowerCase();
  const filtered =
    trimmed && !showFullListOnReopen
      ? options.filter((o) => o.label.toLowerCase().includes(needle))
      : options;
  const exactMatch = options.some((o) => o.label.toLowerCase() === needle);
  const canCreate = Boolean(onCreate) && trimmed.length > 0 && !exactMatch;

  return (
    <Combobox
      value={value}
      inputValue={query}
      disabled={disabled}
      onOpenChange={setOpen}
      autoHighlight
      itemToStringLabel={(itemValue) =>
        itemValue === CREATE ? "" : (options.find((o) => o.id === itemValue)?.label ?? "")
      }
      onInputValueChange={setQuery}
      onValueChange={async (next) => {
        if (!next) {
          onChange(null);
          setQuery("");
          return;
        }
        if (next === CREATE) {
          const created = await onCreate?.(trimmed);
          if (created) {
            onChange(created.id);
            setQuery(created.label);
          }
          return;
        }
        onChange(next);
        setQuery(options.find((o) => o.id === next)?.label ?? "");
      }}
    >
      <ComboboxInputGroup>
        <ComboboxInput id={id} placeholder={placeholder} />
        <ComboboxTrigger />
      </ComboboxInputGroup>
      <ComboboxContent>
        {filtered.map((option) => (
          <ComboboxItem key={option.id} value={option.id}>
            {option.label}
          </ComboboxItem>
        ))}
        {canCreate ? (
          <ComboboxItem value={CREATE}>
            {addLabel ? `${addLabel} ` : ""}“{trimmed}”
          </ComboboxItem>
        ) : filtered.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">{noMatchesLabel}</div>
        ) : null}
      </ComboboxContent>
    </Combobox>
  );
}
