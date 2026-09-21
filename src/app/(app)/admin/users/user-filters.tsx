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
import type { UserFilters as UserFiltersValue } from "@/lib/schemas/user";

import {
  CascadingTerritoryFields,
  type CommuneOption,
  type QuartierOption,
  type TerritoryOption,
  type VilleOption,
} from "../territories/cascading-territory-fields";

type Option = { id: string; name: string };

type FilterKey = "q" | "roleId" | "provinceId" | "villeId" | "communeId" | "quartierId" | "status";

export function UserFilters({
  roles,
  provinces,
  villes,
  communes,
  quartiers,
  filters,
  dict,
  territoryDict,
}: {
  roles: Option[];
  provinces: TerritoryOption[];
  villes: VilleOption[];
  communes: CommuneOption[];
  quartiers: QuartierOption[];
  filters: UserFiltersValue;
  dict: Dictionary["filters"];
  territoryDict: Dictionary["territory"];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The search input is uncontrolled (see the key on it below); reading its
  // value straight from the DOM when a Select applies alongside a
  // still-pending search edit avoids keeping a parallel value in sync —
  // the input's remount (on an external URL change) already keeps this
  // accurate for free.
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
      provinceId: filters.provinceId ?? "",
      villeId: filters.villeId ?? "",
      communeId: filters.communeId ?? "",
      quartierId: filters.quartierId ?? "",
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
    if (merged.roleId) params.set("roleId", merged.roleId);
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
    // Debounced so typing doesn't fire a navigation per keystroke — every
    // other field applies immediately since selecting one is a single,
    // deliberate action rather than a stream of them.
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
          // Remounts (resetting the field to match the URL) whenever the
          // URL's own q changes for a reason other than this input's own
          // debounce — a browser back/forward, or Clear filters.
          key={filters.q ?? ""}
          defaultValue={filters.q}
          onChange={(event) => handleSearchChange(event.target.value)}
          placeholder={dict.searchPlaceholder}
        />
      </div>

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
