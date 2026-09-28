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
import type { UserFilters as UserFiltersValue } from "@/lib/schemas/user";

import { TerritoryPicker, type TerritoryPickerOption } from "../territories/territory-picker";

type Option = { id: string; name: string };

type FilterKey = "q" | "roleId" | "territoryId" | "status";

export function UserFilters({
  roles,
  territories,
  filters,
  dict,
  territoryDict,
}: {
  roles: Option[];
  territories: TerritoryPickerOption[];
  filters: UserFiltersValue;
  dict: Dictionary["filters"];
  territoryDict: Dictionary["territory"];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The search input is uncontrolled; reading its value straight from the
  // DOM when a Select applies alongside a still-pending search edit avoids
  // keeping a parallel value in sync.
  const inputRef = useRef<HTMLInputElement>(null);
  // True for the one filters.q change this component's own debounce just
  // caused — skipped so the sync effect below doesn't fight typing still in
  // progress. Any other filters.q change (browser back/forward, another
  // filter reading a stale value) still resyncs the field to match the URL.
  const ownSearchUpdateRef = useRef(false);
  // Captured once via useState's lazy initializer (a ref can't be read
  // during render under this project's lint rules) — passed to Input's
  // `defaultValue` below, which must never change after mount (React/Base UI
  // only reads it at mount time; feeding it a new value on every re-render
  // is what triggered the "changing the default value of an uncontrolled
  // FieldControl" warning). Every update after mount goes through the sync
  // effect instead, imperatively; the setter here is never called again.
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
      roleId: filters.roleId ?? "",
      territoryId: filters.territoryId ?? "",
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
    if (merged.territoryId) params.set("territoryId", merged.territoryId);
    if (merged.status) params.set("status", merged.status);

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function handleSearchChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Debounced so typing doesn't fire a navigation per keystroke — every
    // other field applies immediately since selecting one is a single,
    // deliberate action rather than a stream of them.
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
    filters.q || filters.roleId || filters.territoryId || filters.status,
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
          defaultValue={initialQ}
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
