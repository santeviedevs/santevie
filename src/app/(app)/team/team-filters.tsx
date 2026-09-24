"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { UserFilters as UserFiltersValue } from "@/lib/schemas/user";

import {
  CascadingTerritoryFields,
  type CommuneOption,
  type QuartierOption,
  type TerritoryOption,
  type VilleOption,
} from "../admin/territories/cascading-territory-fields";

type Option = { id: string; name: string };
type ManagerOption = { id: string; name: string; roleName: string };

// Role is a fixed set of 4 — a plain dropdown is fine. Reports-To can be
// large in a bigger org, so it's a typeable combobox instead: type to
// filter by substring, pick from the narrowed list. Reuses the same
// Combobox primitive as the Territories admin form's ancestor fields
// (territory-combo-fields.tsx), but simpler — no "create new" mode, since
// every manager here already exists.
const ANY_MANAGER = "__any__";

function ReportsToCombobox({
  managers,
  value,
  onSelect,
  label,
  placeholder,
  anyLabel,
  noMatchesLabel,
}: {
  managers: ManagerOption[];
  value: string | null;
  onSelect: (managerId: string | null) => void;
  label: string;
  placeholder: string;
  anyLabel: string;
  noMatchesLabel: string;
}) {
  const selected = managers.find((manager) => manager.id === value) ?? null;
  const [query, setQuery] = useState(selected ? `${selected.name} (${selected.roleName})` : "");

  const filtered = query.trim()
    ? managers.filter((manager) =>
        `${manager.name} ${manager.roleName}`.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : managers;

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="managerId-combobox" className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Combobox
        value={value ?? ANY_MANAGER}
        inputValue={query}
        autoHighlight
        itemToStringLabel={(itemValue) => {
          if (!itemValue || itemValue === ANY_MANAGER) return "";
          const manager = managers.find((m) => m.id === itemValue);
          return manager ? `${manager.name} (${manager.roleName})` : "";
        }}
        onInputValueChange={setQuery}
        onValueChange={(next) => onSelect(next === ANY_MANAGER || !next ? null : next)}
      >
        <ComboboxInputGroup>
          <ComboboxInput id="managerId-combobox" placeholder={placeholder} />
          <ComboboxTrigger />
        </ComboboxInputGroup>
        <ComboboxContent>
          <ComboboxItem value={ANY_MANAGER}>{anyLabel}</ComboboxItem>
          {filtered.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">{noMatchesLabel}</div>
          ) : (
            filtered.map((manager) => (
              <ComboboxItem key={manager.id} value={manager.id}>
                {manager.name} ({manager.roleName})
              </ComboboxItem>
            ))
          )}
        </ComboboxContent>
      </Combobox>
    </div>
  );
}

type FilterKey =
  "q" | "roleId" | "managerId" | "provinceId" | "villeId" | "communeId" | "quartierId" | "status";

// Role and "reports to" are only meaningful when the viewer's downstream
// team actually mixes roles/managers — a Supervisor's team is always just
// their own Delegates, so both would only ever have one possible value.
// `showRoleAndManagerFilters` hides them for that case rather than showing
// filters with nothing to filter. Distinct from UserFilters (admin/users):
// that screen always shows every field and has no "reports to" filter at
// all, since it's not scoped to a viewer's downstream team.
export function TeamFilters({
  roles,
  managers,
  provinces,
  villes,
  communes,
  quartiers,
  filters,
  dict,
  territoryDict,
  showRoleAndManagerFilters,
}: {
  roles: Option[];
  managers: ManagerOption[];
  provinces: TerritoryOption[];
  villes: VilleOption[];
  communes: CommuneOption[];
  quartiers: QuartierOption[];
  filters: UserFiltersValue;
  dict: Dictionary["filters"];
  territoryDict: Dictionary["territory"];
  showRoleAndManagerFilters: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function applyFilters(next: Partial<Record<FilterKey, string | null>>) {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const merged: Record<FilterKey, string> = {
      q: inputRef.current?.value ?? "",
      roleId: filters.roleId ?? "",
      managerId: filters.managerId ?? "",
      provinceId: filters.provinceId ?? "",
      villeId: filters.villeId ?? "",
      communeId: filters.communeId ?? "",
      quartierId: filters.quartierId ?? "",
      status: filters.status ?? "",
      ...Object.fromEntries(
        Object.entries(next)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, value ?? ""]),
      ),
    };

    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.roleId) params.set("roleId", merged.roleId);
    if (merged.managerId) params.set("managerId", merged.managerId);
    if (merged.provinceId) params.set("provinceId", merged.provinceId);
    if (merged.villeId) params.set("villeId", merged.villeId);
    if (merged.communeId) params.set("communeId", merged.communeId);
    if (merged.quartierId) params.set("quartierId", merged.quartierId);
    if (merged.status) params.set("status", merged.status);

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function handleSearchChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applyFilters({ q: value }), 400);
  }

  function clearFilters() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (inputRef.current) inputRef.current.value = "";
    router.push(pathname);
  }

  const hasActiveFilters = Boolean(
    filters.q ||
    filters.roleId ||
    filters.managerId ||
    filters.provinceId ||
    filters.villeId ||
    filters.communeId ||
    filters.quartierId ||
    filters.status,
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="q" className="text-xs text-muted-foreground">
          {dict.searchLabel}
        </label>
        <Input
          id="q"
          ref={inputRef}
          key={filters.q ?? ""}
          defaultValue={filters.q}
          onChange={(event) => handleSearchChange(event.target.value)}
          placeholder={dict.searchPlaceholder}
        />
      </div>

      {showRoleAndManagerFilters ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="roleId" className="text-xs text-muted-foreground">
            {dict.roleLabel}
          </label>
          <Select
            items={[
              { value: "", label: dict.anyRole },
              ...roles.map((role) => ({ value: role.id, label: role.name })),
            ]}
            value={filters.roleId ?? ""}
            onValueChange={(value) => applyFilters({ roleId: value ?? "" })}
          >
            <SelectTrigger id="roleId" className="w-40">
              <SelectValue placeholder={dict.anyRole} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{dict.anyRole}</SelectItem>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {showRoleAndManagerFilters ? (
        // Remounts (resetting the typed text to match the URL) whenever
        // managerId changes for a reason other than this field's own pick —
        // Role narrowing it away, browser back/forward, or Clear filters —
        // same trick the search input uses via its own `key`.
        <ReportsToCombobox
          key={filters.managerId ?? ""}
          managers={managers}
          value={filters.managerId ?? null}
          onSelect={(managerId) => applyFilters({ managerId: managerId ?? "" })}
          label={dict.reportsToLabel}
          placeholder={dict.anyReportsTo}
          anyLabel={dict.anyReportsTo}
          noMatchesLabel={territoryDict.noMatches}
        />
      ) : null}

      <CascadingTerritoryFields
        levels={["province", "ville", "commune", "quartier"]}
        value={{
          provinceId: filters.provinceId ?? null,
          villeId: filters.villeId ?? null,
          communeId: filters.communeId ?? null,
          quartierId: filters.quartierId ?? null,
        }}
        onChange={(patch) =>
          applyFilters({
            provinceId: "provinceId" in patch ? (patch.provinceId ?? "") : undefined,
            villeId: "villeId" in patch ? (patch.villeId ?? "") : undefined,
            communeId: "communeId" in patch ? (patch.communeId ?? "") : undefined,
            quartierId: "quartierId" in patch ? (patch.quartierId ?? "") : undefined,
          })
        }
        data={{ provinces, villes, communes, quartiers }}
        required={false}
        layout="row"
        labels={{
          province: territoryDict.province,
          ville: territoryDict.ville,
          commune: territoryDict.commune,
          quartier: territoryDict.quartier,
        }}
        placeholders={{
          province: territoryDict.anyProvince,
          ville: territoryDict.anyVille,
          commune: territoryDict.anyCommune,
          quartier: territoryDict.anyQuartier,
        }}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="status" className="text-xs text-muted-foreground">
          {dict.statusLabel}
        </label>
        <Select
          items={[
            { value: "", label: dict.anyStatus },
            { value: "ACTIVE", label: dict.active },
            { value: "INACTIVE", label: dict.inactive },
          ]}
          value={filters.status ?? ""}
          onValueChange={(value) => applyFilters({ status: value ?? "" })}
        >
          <SelectTrigger id="status" className="w-36">
            <SelectValue placeholder={dict.anyStatus} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{dict.anyStatus}</SelectItem>
            <SelectItem value="ACTIVE">{dict.active}</SelectItem>
            <SelectItem value="INACTIVE">{dict.inactive}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasActiveFilters ? (
        <Button type="button" variant="ghost" onClick={clearFilters}>
          {dict.clearFilters}
        </Button>
      ) : null}
    </div>
  );
}
