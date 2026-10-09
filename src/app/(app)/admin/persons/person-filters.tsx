"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
import type { PersonFilters as PersonFiltersValue } from "@/lib/schemas/person";

import { TerritoryPicker, type TerritoryPickerOption } from "../territories/territory-picker";

type Option = { id: string; name: string };

type FilterKey =
  "q" | "personTypeId" | "specializationId" | "clientTypeId" | "territoryId" | "status";

function FilterSelect({
  id,
  label,
  anyLabel,
  options,
  value,
  onChange,
  widthClass = "w-44",
}: {
  id: string;
  label: string;
  anyLabel: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  widthClass?: string;
}) {
  const items = [{ value: "", label: anyLabel }, ...options];
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      <Select items={items} value={value} onValueChange={(next) => onChange(next ?? "")}>
        <SelectTrigger id={id} className={widthClass}>
          <SelectValue placeholder={anyLabel} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function PersonFilters({
  personTypes,
  specializations,
  clientTypes,
  territories,
  filters,
  dict,
  territoryDict,
}: {
  personTypes: Option[];
  specializations: Option[];
  clientTypes: Option[];
  territories: TerritoryPickerOption[];
  filters: PersonFiltersValue;
  dict: Dictionary["persons"];
  territoryDict: Dictionary["territory"];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // True for the one filters.q change this component's own debounce just
  // caused — skipped so the sync effect doesn't fight typing in progress.
  const ownSearchUpdateRef = useRef(false);
  const [initialQ] = useState(filters.q);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (ownSearchUpdateRef.current) {
      ownSearchUpdateRef.current = false;
      return;
    }
    if (inputRef.current && inputRef.current.value !== (filters.q ?? "")) {
      inputRef.current.value = filters.q ?? "";
    }
  }, [filters.q]);

  function applyFilters(next: Partial<Record<FilterKey, string | null>>) {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const merged: Record<FilterKey, string> = {
      q: inputRef.current?.value ?? "",
      personTypeId: filters.personTypeId ?? "",
      specializationId: filters.specializationId ?? "",
      clientTypeId: filters.clientTypeId ?? "",
      territoryId: filters.territoryId ?? "",
      status: filters.status ?? "",
      ...Object.fromEntries(
        Object.entries(next)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, value ?? ""]),
      ),
    };

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function handleSearchChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      ownSearchUpdateRef.current = true;
      applyFilters({ q: value });
    }, 400);
  }

  function clearFilters() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (inputRef.current) inputRef.current.value = "";
    router.push(pathname);
  }

  const hasActiveFilters = Boolean(
    filters.q ||
    filters.personTypeId ||
    filters.specializationId ||
    filters.clientTypeId ||
    filters.territoryId ||
    filters.status,
  );

  const toOptions = (rows: Option[]) => rows.map((r) => ({ value: r.id, label: r.name }));

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="q" className="text-xs text-muted-foreground">
          {dict.searchLabel}
        </label>
        <Input
          id="q"
          ref={inputRef}
          defaultValue={initialQ}
          onChange={(event) => handleSearchChange(event.target.value)}
          placeholder={dict.searchPlaceholder}
        />
      </div>

      <FilterSelect
        id="personTypeId"
        label={dict.typeFilterLabel}
        anyLabel={dict.anyType}
        options={toOptions(personTypes)}
        value={filters.personTypeId ?? ""}
        onChange={(value) => applyFilters({ personTypeId: value })}
      />

      <FilterSelect
        id="specializationId"
        label={dict.specializationFilterLabel}
        anyLabel={dict.anySpecialization}
        options={toOptions(specializations)}
        value={filters.specializationId ?? ""}
        onChange={(value) => applyFilters({ specializationId: value })}
      />

      <FilterSelect
        id="clientTypeId"
        label={dict.centerTypeFilterLabel}
        anyLabel={dict.anyCenterType}
        options={toOptions(clientTypes)}
        value={filters.clientTypeId ?? ""}
        onChange={(value) => applyFilters({ clientTypeId: value })}
      />

      <TerritoryPicker
        id="territoryId"
        label={territoryDict.territoryFilterLabel}
        placeholder={territoryDict.anyTerritoryFilter}
        clearLabel={territoryDict.anyTerritoryFilter}
        noResultsLabel={territoryDict.noMatches}
        options={territories}
        value={filters.territoryId ?? null}
        onChange={(next) => applyFilters({ territoryId: next ?? "" })}
      />

      <FilterSelect
        id="status"
        label={dict.statusFilterLabel}
        anyLabel={dict.anyStatus}
        options={[
          { value: "ACTIVE", label: dict.filterActive },
          { value: "INACTIVE", label: dict.filterInactive },
        ]}
        value={filters.status ?? ""}
        onChange={(value) => applyFilters({ status: value })}
        widthClass="w-36"
      />

      {hasActiveFilters ? (
        <Button type="button" variant="ghost" onClick={clearFilters}>
          {dict.clearFilters}
        </Button>
      ) : null}
    </div>
  );
}
