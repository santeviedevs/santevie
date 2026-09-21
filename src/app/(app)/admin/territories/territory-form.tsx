"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { TerritoryLevel } from "@/lib/schemas/territory";

import { createTerritoryAction, type TerritoryFormState, updateTerritoryAction } from "./actions";
import type { CommuneOption, TerritoryOption, VilleOption } from "./cascading-territory-fields";
import {
  type AncestorLevelValue,
  type ComboTerritoryLevel,
  hasAncestorValue,
  TerritoryComboFields,
  type TerritoryComboValue,
} from "./territory-combo-fields";

type Status = "ACTIVE" | "INACTIVE";

type TerritoryFormProps = {
  mode: "create" | "edit";
  options: { provinces: TerritoryOption[]; villes: VilleOption[]; communes: CommuneOption[] };
  // Edit mode only — the specific Province/Ville/Commune/Quartier row this
  // page is editing, at whatever level it is. `provinceId`/`villeId`/
  // `communeId` are only the ancestors *above* `level` (undefined at or
  // below it) — e.g. a Ville-level entry has `provinceId` but not
  // `villeId`/`communeId`.
  defaultValues?: {
    id: string;
    level: TerritoryLevel;
    provinceId?: string;
    villeId?: string;
    communeId?: string;
    name: string;
    status: Status;
  };
  dict: Dictionary["territoriesPage"];
  hierarchyDict: Dictionary["territory"];
};

const EMPTY: TerritoryComboValue = {
  province: { mode: "existing", id: "" },
  ville: { mode: "existing", id: "" },
  commune: { mode: "existing", id: "" },
};

// The ancestor comboboxes to show above the level being edited — editing
// itself never *extends* a Territory deeper than its own level via these
// fields (they only reassign existing ancestors), so e.g. a Ville-level
// entry only shows a Province field here, not Commune.
const ANCESTOR_LEVELS_FOR: Record<TerritoryLevel, readonly ComboTerritoryLevel[]> = {
  province: [],
  ville: ["province"],
  commune: ["province", "ville"],
  quartier: ["province", "ville", "commune"],
};

// The comboboxes to show *below* the level being edited, for optionally
// growing the hierarchy right from its edit page — e.g. a Province-level
// entry can add a new Ville (and, cascading further, a Commune) under it.
// A Quartier is always the trailing plain-name field past whichever of
// these is deepest (or immediately, for a Commune-level entry — see
// hasAncestorValue(downstreamAncestry.commune) below).
const DOWNSTREAM_LEVELS_FOR: Record<TerritoryLevel, readonly ComboTerritoryLevel[]> = {
  province: ["ville", "commune"],
  ville: ["commune"],
  commune: [],
  quartier: [],
};

function downstreamSeed(level: TerritoryLevel, id: string): TerritoryComboValue {
  const self: AncestorLevelValue = { mode: "existing", id };
  const blank: AncestorLevelValue = { mode: "existing", id: "" };
  if (level === "province") return { province: self, ville: blank, commune: blank };
  if (level === "ville") return { province: blank, ville: self, commune: blank };
  if (level === "commune") return { province: blank, ville: blank, commune: self };
  return { province: blank, ville: blank, commune: blank };
}

export function TerritoryForm({
  mode,
  options,
  defaultValues,
  dict,
  hierarchyDict,
}: TerritoryFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const draftKey = `territory-form-draft:${pathname}`;
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const ancestorLevels =
    mode === "edit" && defaultValues ? ANCESTOR_LEVELS_FOR[defaultValues.level] : undefined;

  const [ancestry, setAncestry] = useState<TerritoryComboValue>(
    defaultValues
      ? {
          province: { mode: "existing", id: defaultValues.provinceId ?? "" },
          ville: { mode: "existing", id: defaultValues.villeId ?? "" },
          commune: { mode: "existing", id: defaultValues.communeId ?? "" },
        }
      : EMPTY,
  );
  // In create mode this is the (optional) Quartier being created; in edit
  // mode it's always the rename of whichever row `defaultValues.level` is.
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [status, setStatus] = useState<Status>(defaultValues?.status ?? "ACTIVE");

  const downstreamLevels =
    mode === "edit" && defaultValues ? DOWNSTREAM_LEVELS_FOR[defaultValues.level] : [];
  // Edit mode's "also add a new one below" fields — always start blank
  // (they're for adding one new child now, not for browsing/editing
  // existing ones), seeded only so the cascading combobox filters know
  // which Province/Ville this row's new child would belong under.
  const [downstreamAncestry, setDownstreamAncestry] = useState<TerritoryComboValue>(
    defaultValues ? downstreamSeed(defaultValues.level, defaultValues.id) : EMPTY,
  );
  const [downstreamQuartierName, setDownstreamQuartierName] = useState("");

  // Ancestor status toggles, edit mode only. Keyed by the row's own id
  // rather than by level — so switching Province to a different existing
  // row naturally starts from *that* row's real status (a fresh key) with
  // no explicit reset needed, and switching back to the original still
  // remembers any pending toggle made earlier in the same session.
  const [statusOverrides, setStatusOverrides] = useState<Record<string, Status>>({});

  function realAncestorStatus(level: ComboTerritoryLevel, id: string): Status {
    const list =
      level === "province"
        ? options.provinces
        : level === "ville"
          ? options.villes
          : options.communes;
    return list.find((item) => item.id === id)?.status ?? "ACTIVE";
  }

  function effectiveAncestorStatus(level: ComboTerritoryLevel, id: string): Status {
    return statusOverrides[`${level}:${id}`] ?? realAncestorStatus(level, id);
  }

  // If a session-expiry redirect left a draft behind for this exact page,
  // restore it once and discard it — it's meant to survive one re-login,
  // not linger and reappear on a later, unrelated visit to this form.
  useEffect(() => {
    const saved = sessionStorage.getItem(draftKey);
    if (saved) {
      const draft = JSON.parse(saved) as { ancestry: TerritoryComboValue; name: string };
      // One-time recovery of a draft left by a session-expiry redirect, not
      // a render-loop synchronization — safe to set state directly here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAncestry(draft.ancestry);
      setName(draft.name);
      sessionStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  const selfLabel =
    mode === "edit" && defaultValues ? hierarchyDict[defaultValues.level] : hierarchyDict.quartier;

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (mode === "edit" && !name.trim()) {
      setFormError(selfLabel + " name is required.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();

      if (mode === "edit" && defaultValues) {
        formData.set("id", defaultValues.id);
        formData.set("level", defaultValues.level);
        formData.set("name", name);
        formData.set("status", status);

        for (const level of ancestorLevels ?? []) {
          const value = ancestry[level];
          formData.set(`${level}Mode`, value.mode);
          if (value.mode === "existing") formData.set(`${level}Id`, value.id);
          else formData.set(`${level}Name`, value.name);

          if (value.mode === "existing" && value.id) {
            formData.set(`${level}Status`, effectiveAncestorStatus(level, value.id));
          }
        }

        // "Also add a new one below" — whichever downstream levels are
        // shown map to "newVille"/"newCommune" regardless of which
        // combobox instance rendered them (a Province-level edit's Ville
        // field and a Commune-level edit's would-be Ville field, if it had
        // one, both mean the same thing server-side: the new Ville to add).
        for (const level of downstreamLevels) {
          const value = downstreamAncestry[level];
          if (!hasAncestorValue(value)) continue;
          const prefix = level === "ville" ? "newVille" : "newCommune";
          formData.set(`${prefix}Mode`, value.mode);
          if (value.mode === "existing") formData.set(`${prefix}Id`, value.id);
          else formData.set(`${prefix}Name`, value.name);
        }
        if (downstreamQuartierName.trim()) {
          formData.set("newQuartierName", downstreamQuartierName);
        }
      } else {
        formData.set("provinceMode", ancestry.province.mode);
        if (ancestry.province.mode === "existing") formData.set("provinceId", ancestry.province.id);
        else formData.set("provinceName", ancestry.province.name);

        formData.set("villeMode", ancestry.ville.mode);
        if (ancestry.ville.mode === "existing") formData.set("villeId", ancestry.ville.id);
        else formData.set("villeName", ancestry.ville.name);

        formData.set("communeMode", ancestry.commune.mode);
        if (ancestry.commune.mode === "existing") formData.set("communeId", ancestry.commune.id);
        else formData.set("communeName", ancestry.commune.name);

        formData.set("quartierName", name);
      }

      const action = mode === "create" ? createTerritoryAction : updateTerritoryAction;
      const result: TerritoryFormState = await action({ error: null }, formData);

      if (result.sessionExpired) {
        sessionStorage.setItem(draftKey, JSON.stringify({ ancestry, name }));
        router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
        return;
      }

      if (result.error) {
        setFormError(result.error);
        return;
      }

      toast.success(mode === "create" ? dict.created : dict.updated);
      router.push("/admin/territories");
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4" noValidate>
      <TerritoryComboFields
        value={ancestry}
        onChange={(patch) => setAncestry((prev) => ({ ...prev, ...patch }))}
        data={options}
        disabled={isPending}
        labels={{
          province: hierarchyDict.province,
          ville: hierarchyDict.ville,
          commune: hierarchyDict.commune,
        }}
        placeholderTemplate={hierarchyDict.typeOrSelectPlaceholder}
        createOptionTemplate={hierarchyDict.createOption}
        noResultsLabel={hierarchyDict.noMatches}
        levels={ancestorLevels}
        statusToggles={
          mode === "edit"
            ? {
                province: {
                  checked:
                    ancestry.province.mode === "existing" && ancestry.province.id
                      ? effectiveAncestorStatus("province", ancestry.province.id) === "ACTIVE"
                      : true,
                },
                ville: {
                  checked:
                    ancestry.ville.mode === "existing" && ancestry.ville.id
                      ? effectiveAncestorStatus("ville", ancestry.ville.id) === "ACTIVE"
                      : true,
                },
                commune: {
                  checked:
                    ancestry.commune.mode === "existing" && ancestry.commune.id
                      ? effectiveAncestorStatus("commune", ancestry.commune.id) === "ACTIVE"
                      : true,
                },
                onChange: (level, nextStatus) => {
                  const value = ancestry[level];
                  if (value.mode !== "existing" || !value.id) return;
                  setStatusOverrides((prev) => ({ ...prev, [`${level}:${value.id}`]: nextStatus }));
                },
                label: (levelLabel) => `${dict.activate} ${levelLabel}`,
              }
            : undefined
        }
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="territoryName">{selfLabel}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="territoryName"
            className="flex-1"
            disabled={isPending || (mode === "create" && !hasAncestorValue(ancestry.commune))}
            value={name}
            placeholder={
              mode === "create"
                ? hierarchyDict.typeOrCreatePlaceholder.replace("{label}", hierarchyDict.quartier)
                : undefined
            }
            onChange={(event) => setName(event.target.value)}
          />
          {mode === "edit" ? (
            <Switch
              id="status"
              aria-label={`${dict.activate} ${selfLabel}`}
              disabled={isPending}
              checked={status !== "INACTIVE"}
              onCheckedChange={(checked) => setStatus(checked ? "ACTIVE" : "INACTIVE")}
            />
          ) : null}
        </div>
      </div>

      {mode === "edit" && defaultValues && defaultValues.level !== "quartier" ? (
        <div className="flex flex-col gap-4 border-t border-border pt-4">
          <p className="text-sm font-medium text-muted-foreground">{dict.addChildHeading}</p>

          {downstreamLevels.length > 0 ? (
            <TerritoryComboFields
              value={downstreamAncestry}
              onChange={(patch) => setDownstreamAncestry((prev) => ({ ...prev, ...patch }))}
              data={options}
              disabled={isPending}
              labels={{
                province: hierarchyDict.province,
                ville: hierarchyDict.ville,
                commune: hierarchyDict.commune,
              }}
              placeholderTemplate={hierarchyDict.typeOrSelectPlaceholder}
              createOptionTemplate={hierarchyDict.createOption}
              noResultsLabel={hierarchyDict.noMatches}
              levels={downstreamLevels}
            />
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="newQuartierName">{hierarchyDict.quartier}</Label>
            <Input
              id="newQuartierName"
              disabled={isPending || !hasAncestorValue(downstreamAncestry.commune)}
              value={downstreamQuartierName}
              placeholder={hierarchyDict.typeOrCreatePlaceholder.replace(
                "{label}",
                hierarchyDict.quartier,
              )}
              onChange={(event) => setDownstreamQuartierName(event.target.value)}
            />
          </div>
        </div>
      ) : null}

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? dict.saving : mode === "create" ? dict.createTerritory : dict.save}
      </Button>
    </form>
  );
}
