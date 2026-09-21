"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { TerritoryFilters as TerritoryFiltersValue } from "@/lib/schemas/territory";

import {
  CascadingTerritoryFields,
  type CommuneOption,
  type TerritoryOption,
  type VilleOption,
} from "./cascading-territory-fields";

type FilterKey = "q" | "provinceId" | "villeId" | "communeId" | "status";

export function TerritoryFilters({
  provinces,
  villes,
  communes,
  filters,
  dict,
  hierarchyDict,
}: {
  provinces: TerritoryOption[];
  villes: VilleOption[];
  communes: CommuneOption[];
  filters: TerritoryFiltersValue;
  dict: Dictionary["territoriesPage"];
  hierarchyDict: Dictionary["territory"];
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
      provinceId: filters.provinceId ?? "",
      villeId: filters.villeId ?? "",
      communeId: filters.communeId ?? "",
      status: filters.status ?? "",
      // `undefined` means "this key wasn't touched" (see the callers below)
      // — must be dropped before merging, not turned into "", or every
      // partial patch would wipe every *other* filter back to unset.
      ...Object.fromEntries(
        Object.entries(next)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, value ?? ""]),
      ),
    };

    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.provinceId) params.set("provinceId", merged.provinceId);
    if (merged.villeId) params.set("villeId", merged.villeId);
    if (merged.communeId) params.set("communeId", merged.communeId);
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
    filters.q || filters.provinceId || filters.villeId || filters.communeId || filters.status,
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

      <CascadingTerritoryFields
        levels={["province", "ville", "commune"]}
        value={{
          provinceId: filters.provinceId ?? null,
          villeId: filters.villeId ?? null,
          communeId: filters.communeId ?? null,
          quartierId: null,
        }}
        onChange={(patch) =>
          applyFilters({
            provinceId: "provinceId" in patch ? (patch.provinceId ?? "") : undefined,
            villeId: "villeId" in patch ? (patch.villeId ?? "") : undefined,
            communeId: "communeId" in patch ? (patch.communeId ?? "") : undefined,
          })
        }
        data={{ provinces, villes, communes, quartiers: [] }}
        required={false}
        layout="row"
        labels={{
          province: hierarchyDict.province,
          ville: hierarchyDict.ville,
          commune: hierarchyDict.commune,
          quartier: hierarchyDict.quartier,
        }}
        placeholders={{
          province: hierarchyDict.anyProvince,
          ville: hierarchyDict.anyVille,
          commune: hierarchyDict.anyCommune,
          quartier: hierarchyDict.anyQuartier,
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
