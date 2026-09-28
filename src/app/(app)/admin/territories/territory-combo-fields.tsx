"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";

import type {
  CommuneOption,
  QuartierOption,
  TerritoryOption,
  VilleOption,
} from "./cascading-territory-fields";

export type AncestorLevelValue = { mode: "existing"; id: string } | { mode: "new"; name: string };

export type TerritoryComboValue = {
  province: AncestorLevelValue;
  ville: AncestorLevelValue;
  commune: AncestorLevelValue;
  quartier: AncestorLevelValue;
};

export type ComboTerritoryLevel = "province" | "ville" | "commune" | "quartier";

const EMPTY_EXISTING: AncestorLevelValue = { mode: "existing", id: "" };

const CREATE_VALUE = "__create__";

// Whether a level has actually been given a value — an existing row picked,
// or a non-blank name typed for a new one. Used to decide when the field
// below it should be enabled, since an empty "new" (an input the user
// cleared) is functionally the same as unset.
export function hasAncestorValue(value: AncestorLevelValue): boolean {
  return value.mode === "existing" ? value.id !== "" : value.name.trim() !== "";
}

type ComboItem = { id: string; name: string; status?: "ACTIVE" | "INACTIVE" };

// One typable Province/Ville/Commune/Quartier field: pick an existing row
// from the dropdown, or type a name that doesn't match one and see
// `+ Create "<name>"` — selecting it (or just leaving the typed text as-is)
// creates that row under the parent this field was given. Matching an
// existing row's name exactly (case-insensitive) is treated the same as
// picking it from the list, since the unique-per-parent name constraint
// means that name can only refer to one row under this parent anyway.
function AncestorCombobox({
  id,
  items,
  value,
  onChange,
  disabled,
  label,
  placeholder,
  createOptionTemplate,
  noResultsLabel,
}: {
  id: string;
  items: ComboItem[];
  value: AncestorLevelValue;
  onChange: (value: AncestorLevelValue) => void;
  disabled?: boolean;
  label: string;
  placeholder: string;
  createOptionTemplate: string;
  noResultsLabel: string;
}) {
  const inputValue =
    value.mode === "existing"
      ? (items.find((item) => item.id === value.id)?.name ?? "")
      : value.name;

  const query = inputValue.trim();

  const selectable = items.filter(
    (item) => item.status !== "INACTIVE" || (value.mode === "existing" && item.id === value.id),
  );

  const exactMatch = query
    ? selectable.find((item) => item.name.trim().toLowerCase() === query.toLowerCase())
    : undefined;

  // Reopening a field that already holds an existing selection: show every
  // option, not just the one substring-matching the selected label — the
  // text hasn't changed, so this isn't a search yet, it's "let me pick a
  // different one." Filtering only kicks in once typing actually diverges
  // from the selection (which flips this to "new" mode, below).
  const filtered =
    value.mode === "existing" && value.id
      ? selectable
      : query
        ? selectable.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
        : selectable;

  const listItems: Array<{ value: string; label: string }> = filtered.map((item) => ({
    value: item.id,
    label: item.name,
  }));
  if (query && !exactMatch) {
    listItems.push({ value: CREATE_VALUE, label: createOptionTemplate.replace("{name}", query) });
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Combobox
        // Base UI's Combobox forcibly re-syncs the input's text to
        // `itemToStringLabel(selectedValue)` any time the selected value
        // changes (after every selection, and again once the popup
        // finishes closing) — it has no native concept of "freeform text,
        // nothing selected". So "new" mode can't be represented as no
        // selection (`null` stringifies to "", wiping what was typed);
        // instead it's represented by the CREATE_VALUE sentinel "selected",
        // which itemToStringLabel below resolves back to the typed name.
        value={value.mode === "existing" ? value.id : value.name.trim() ? CREATE_VALUE : null}
        inputValue={inputValue}
        disabled={disabled}
        autoHighlight
        itemToStringLabel={(itemValue) => {
          if (itemValue === CREATE_VALUE) return inputValue;
          return items.find((item) => item.id === itemValue)?.name ?? "";
        }}
        onInputValueChange={(next) => {
          const match = selectable.find(
            (item) => item.name.trim().toLowerCase() === next.trim().toLowerCase(),
          );
          onChange(match ? { mode: "existing", id: match.id } : { mode: "new", name: next });
        }}
        onValueChange={(next) => {
          if (!next || next === CREATE_VALUE) {
            onChange({ mode: "new", name: query });
            return;
          }
          onChange({ mode: "existing", id: next });
        }}
      >
        <ComboboxInputGroup>
          <ComboboxInput id={id} placeholder={placeholder} />
          <ComboboxTrigger />
        </ComboboxInputGroup>
        <ComboboxContent>
          {listItems.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">{noResultsLabel}</div>
          ) : (
            listItems.map((item) => (
              <ComboboxItem key={item.value} value={item.value}>
                {item.label}
              </ComboboxItem>
            ))
          )}
        </ComboboxContent>
      </Combobox>
    </div>
  );
}

type LevelLabels = { province: string; ville: string; commune: string; quartier: string };

const ALL_LEVELS: readonly ComboTerritoryLevel[] = ["province", "ville", "commune", "quartier"];

// The Territories admin form's path picker — one typable combobox per
// level, cascading: picking a new Province clears Ville/Commune/Quartier,
// picking a new Ville clears Commune/Quartier, and so on. Used for both
// creating a Territory (any level optional past Province) and re-pointing
// an existing one to a different path.
export function TerritoryComboFields({
  value,
  onChange,
  data,
  disabled,
  labels,
  placeholderTemplate,
  createOptionTemplate,
  noResultsLabel,
  levels = ALL_LEVELS,
}: {
  value: TerritoryComboValue;
  onChange: (patch: Partial<TerritoryComboValue>) => void;
  data: {
    provinces: TerritoryOption[];
    villes: VilleOption[];
    communes: CommuneOption[];
    quartiers: QuartierOption[];
  };
  disabled?: boolean;
  labels: LevelLabels;
  // "Type or select {label}..." — interpolated per level below.
  placeholderTemplate: string;
  createOptionTemplate: string;
  noResultsLabel: string;
  levels?: readonly ComboTerritoryLevel[];
}) {
  const selectedProvinceId = value.province.mode === "existing" ? value.province.id : "";
  const villesForProvince = selectedProvinceId
    ? data.villes.filter((v) => v.provinceId === selectedProvinceId)
    : [];

  const selectedVilleId = value.ville.mode === "existing" ? value.ville.id : "";
  const communesForVille = selectedVilleId
    ? data.communes.filter((c) => c.villeId === selectedVilleId)
    : [];

  const selectedCommuneId = value.commune.mode === "existing" ? value.commune.id : "";
  const quartiersForCommune = selectedCommuneId
    ? data.quartiers.filter((q) => q.communeId === selectedCommuneId)
    : [];

  return (
    <div className="flex flex-col gap-4">
      {levels.includes("province") ? (
        <AncestorCombobox
          id="province-combobox"
          label={labels.province}
          placeholder={placeholderTemplate.replace("{label}", labels.province)}
          items={data.provinces}
          value={value.province}
          disabled={disabled}
          createOptionTemplate={createOptionTemplate}
          noResultsLabel={noResultsLabel}
          onChange={(next) =>
            onChange({
              province: next,
              ville: EMPTY_EXISTING,
              commune: EMPTY_EXISTING,
              quartier: EMPTY_EXISTING,
            })
          }
        />
      ) : null}

      {levels.includes("ville") ? (
        <AncestorCombobox
          id="ville-combobox"
          label={labels.ville}
          placeholder={placeholderTemplate.replace("{label}", labels.ville)}
          items={villesForProvince}
          value={value.ville}
          disabled={disabled || !hasAncestorValue(value.province)}
          createOptionTemplate={createOptionTemplate}
          noResultsLabel={noResultsLabel}
          onChange={(next) =>
            onChange({ ville: next, commune: EMPTY_EXISTING, quartier: EMPTY_EXISTING })
          }
        />
      ) : null}

      {levels.includes("commune") ? (
        <AncestorCombobox
          id="commune-combobox"
          label={labels.commune}
          placeholder={placeholderTemplate.replace("{label}", labels.commune)}
          items={communesForVille}
          value={value.commune}
          disabled={disabled || !hasAncestorValue(value.ville)}
          createOptionTemplate={createOptionTemplate}
          noResultsLabel={noResultsLabel}
          onChange={(next) => onChange({ commune: next, quartier: EMPTY_EXISTING })}
        />
      ) : null}

      {levels.includes("quartier") ? (
        <AncestorCombobox
          id="quartier-combobox"
          label={labels.quartier}
          placeholder={placeholderTemplate.replace("{label}", labels.quartier)}
          items={quartiersForCommune}
          value={value.quartier}
          disabled={disabled || !hasAncestorValue(value.commune)}
          createOptionTemplate={createOptionTemplate}
          noResultsLabel={noResultsLabel}
          onChange={(next) => onChange({ quartier: next })}
        />
      ) : null}
    </div>
  );
}
