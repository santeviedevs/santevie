"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { ClientFilters as ClientFiltersValue } from "@/lib/schemas/client";

import {
  CascadingTerritoryFields,
  type CommuneOption,
  type QuartierOption,
  type TerritoryOption,
  type VilleOption,
} from "../territories/cascading-territory-fields";

type ClientType = { id: string; name: string };

type FilterKey =
  | "q"
  | "typeId"
  | "provinceId"
  | "villeId"
  | "communeId"
  | "quartierId"
  | "status"
  | "missingCoordinates";

export function ClientFilters({
  types,
  provinces,
  villes,
  communes,
  quartiers,
  filters,
  dict,
  territoryDict,
}: {
  types: ClientType[];
  provinces: TerritoryOption[];
  villes: VilleOption[];
  communes: CommuneOption[];
  quartiers: QuartierOption[];
  filters: ClientFiltersValue;
  dict: Dictionary["clientFilters"];
  territoryDict: Dictionary["territory"];
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
      typeId: filters.typeId ?? "",
      provinceId: filters.provinceId ?? "",
      villeId: filters.villeId ?? "",
      communeId: filters.communeId ?? "",
      quartierId: filters.quartierId ?? "",
      status: filters.status ?? "",
      missingCoordinates: filters.missingCoordinates ? "true" : "",
      ...Object.fromEntries(
        Object.entries(next)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, value ?? ""]),
      ),
    };

    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.typeId) params.set("typeId", merged.typeId);
    if (merged.provinceId) params.set("provinceId", merged.provinceId);
    if (merged.villeId) params.set("villeId", merged.villeId);
    if (merged.communeId) params.set("communeId", merged.communeId);
    if (merged.quartierId) params.set("quartierId", merged.quartierId);
    if (merged.status) params.set("status", merged.status);
    if (merged.missingCoordinates) params.set("missingCoordinates", merged.missingCoordinates);

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
    filters.typeId ||
    filters.provinceId ||
    filters.villeId ||
    filters.communeId ||
    filters.quartierId ||
    filters.status ||
    filters.missingCoordinates,
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

      <div className="flex flex-col gap-1">
        <label htmlFor="typeId" className="text-xs text-muted-foreground">
          {dict.typeLabel}
        </label>
        <Select
          items={[
            { value: "", label: dict.anyType },
            ...types.map((type) => ({ value: type.id, label: type.name })),
          ]}
          value={filters.typeId ?? ""}
          onValueChange={(value) => applyFilters({ typeId: value ?? "" })}
        >
          <SelectTrigger id="typeId" className="w-40">
            <SelectValue placeholder={dict.anyType} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{dict.anyType}</SelectItem>
            {types.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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

      <div className="flex items-center gap-2 pb-2">
        <Checkbox
          id="missingCoordinates"
          checked={filters.missingCoordinates ?? false}
          onCheckedChange={(checked) =>
            applyFilters({ missingCoordinates: checked === true ? "true" : "" })
          }
        />
        <Label htmlFor="missingCoordinates" className="font-normal text-sm">
          {dict.missingCoordinates}
        </Label>
      </div>

      {hasActiveFilters ? (
        <Button type="button" variant="ghost" onClick={clearFilters}>
          {dict.clearFilters}
        </Button>
      ) : null}
    </div>
  );
}
