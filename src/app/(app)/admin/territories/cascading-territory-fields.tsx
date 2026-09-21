"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type TerritoryLevel = "province" | "ville" | "commune" | "quartier";

// `status` is only populated by the Territories edit form's option lists
// (it needs every row, active or not, to show/toggle the currently
// assigned ancestor); every other caller here keeps using the active-only
// lists and simply never sets it.
export type TerritoryOption = { id: string; name: string; status?: "ACTIVE" | "INACTIVE" };
export type VilleOption = TerritoryOption & { provinceId: string };
export type CommuneOption = TerritoryOption & { villeId: string };
export type QuartierOption = TerritoryOption & { communeId: string };

export type TerritoryValue = {
  provinceId: string | null;
  villeId: string | null;
  communeId: string | null;
  quartierId: string | null;
};

export type TerritoryOptionData = {
  provinces: TerritoryOption[];
  villes: VilleOption[];
  communes: CommuneOption[];
  quartiers: QuartierOption[];
};

type LevelLabels = { province: string; ville: string; commune: string; quartier: string };

// Read-only cascading selection from *existing* Provinces/Villes/Communes/
// Quartiers — used by the Users form and by both list pages' filter bars.
// Picking a new value for a level clears everything below it. Adding a
// brand-new Province/Ville/Commune/Quartier only ever happens on the
// Territories admin form (territory-combo-fields.tsx), never here.
type CascadingTerritoryFieldsProps = {
  // Which selects to render, in order.
  levels: readonly TerritoryLevel[];
  value: TerritoryValue;
  onChange: (patch: Partial<TerritoryValue>) => void;
  data: TerritoryOptionData;
  disabled?: boolean;
  // Whether each rendered select must have a value. false lets any level
  // stay unset (the Users page: "select all four" but none required; a
  // filter bar: "any" means unset too).
  required?: boolean;
  labels: LevelLabels;
  placeholders: LevelLabels;
  // "column" (default) stacks levels for a form; "row" lays them out
  // side by side, narrower, matching the other filter controls on the
  // Territories and Users list pages.
  layout?: "column" | "row";
};

const NONE = "__none__";

export function CascadingTerritoryFields({
  levels,
  value,
  onChange,
  data,
  disabled,
  required = true,
  labels,
  placeholders,
  layout = "column",
}: CascadingTerritoryFieldsProps) {
  const villesForProvince = value.provinceId
    ? data.villes.filter((v) => v.provinceId === value.provinceId)
    : [];
  const communesForVille = value.villeId
    ? data.communes.filter((c) => c.villeId === value.villeId)
    : [];
  const quartiersForCommune = value.communeId
    ? data.quartiers.filter((q) => q.communeId === value.communeId)
    : [];

  function renderLevel(level: TerritoryLevel) {
    if (level === "province") {
      return (
        <div key="province" className="flex flex-col gap-2">
          <Label htmlFor="provinceId">{labels.province}</Label>
          <Select
            items={[
              ...(required ? [] : [{ value: NONE, label: placeholders.province }]),
              ...data.provinces.map((p) => ({ value: p.id, label: p.name })),
            ]}
            value={value.provinceId ?? (required ? "" : NONE)}
            disabled={disabled}
            onValueChange={(next) =>
              onChange({
                provinceId: next === NONE ? null : next,
                villeId: null,
                communeId: null,
                quartierId: null,
              })
            }
          >
            <SelectTrigger id="provinceId" className="w-full">
              <SelectValue placeholder={placeholders.province} />
            </SelectTrigger>
            <SelectContent>
              {!required ? <SelectItem value={NONE}>{placeholders.province}</SelectItem> : null}
              {data.provinces.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (level === "ville") {
      const parentSelected = Boolean(value.provinceId);
      return (
        <div key="ville" className="flex flex-col gap-2">
          <Label htmlFor="villeId">{labels.ville}</Label>
          <Select
            items={[
              ...(required ? [] : [{ value: NONE, label: placeholders.ville }]),
              ...villesForProvince.map((v) => ({ value: v.id, label: v.name })),
            ]}
            value={value.villeId ?? (required ? "" : NONE)}
            disabled={disabled || !parentSelected}
            onValueChange={(next) =>
              onChange({
                villeId: next === NONE ? null : next,
                communeId: null,
                quartierId: null,
              })
            }
          >
            <SelectTrigger id="villeId" className="w-full">
              <SelectValue placeholder={placeholders.ville} />
            </SelectTrigger>
            <SelectContent>
              {!required ? <SelectItem value={NONE}>{placeholders.ville}</SelectItem> : null}
              {villesForProvince.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (level === "commune") {
      const parentSelected = Boolean(value.villeId);
      return (
        <div key="commune" className="flex flex-col gap-2">
          <Label htmlFor="communeId">{labels.commune}</Label>
          <Select
            items={[
              ...(required ? [] : [{ value: NONE, label: placeholders.commune }]),
              ...communesForVille.map((c) => ({ value: c.id, label: c.name })),
            ]}
            value={value.communeId ?? (required ? "" : NONE)}
            disabled={disabled || !parentSelected}
            onValueChange={(next) =>
              onChange({ communeId: next === NONE ? null : next, quartierId: null })
            }
          >
            <SelectTrigger id="communeId" className="w-full">
              <SelectValue placeholder={placeholders.commune} />
            </SelectTrigger>
            <SelectContent>
              {!required ? <SelectItem value={NONE}>{placeholders.commune}</SelectItem> : null}
              {communesForVille.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    const parentSelected = Boolean(value.communeId);
    return (
      <div key="quartier" className="flex flex-col gap-2">
        <Label htmlFor="quartierId">{labels.quartier}</Label>
        <Select
          items={[
            ...(required ? [] : [{ value: NONE, label: placeholders.quartier }]),
            ...quartiersForCommune.map((q) => ({ value: q.id, label: q.name })),
          ]}
          value={value.quartierId ?? (required ? "" : NONE)}
          disabled={disabled || !parentSelected}
          onValueChange={(next) => onChange({ quartierId: next === NONE ? null : next })}
        >
          <SelectTrigger id="quartierId" className="w-full">
            <SelectValue placeholder={placeholders.quartier} />
          </SelectTrigger>
          <SelectContent>
            {!required ? <SelectItem value={NONE}>{placeholders.quartier}</SelectItem> : null}
            {quartiersForCommune.map((q) => (
              <SelectItem key={q.id} value={q.id}>
                {q.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className={layout === "row" ? "flex flex-wrap items-start gap-3" : "flex flex-col gap-4"}>
      {levels.map(renderLevel)}
    </div>
  );
}
