"use client";

import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { HolidayFilters as HolidayFiltersValue } from "@/lib/schemas/holiday";

type FilterKey = "territoryId" | "year";

// Same client-updates-URL / server-does-the-filtering pattern as
// TerritoryFilters and LeaveFilters — applies on change, no submit button,
// and Clear genuinely clears (navigates to the bare path) rather than
// resubmitting whatever is currently selected.
export function HolidayFilters({
  territories,
  years,
  filters,
  dict,
}: {
  territories: { id: string; code: string; label: string }[];
  years: number[];
  filters: HolidayFiltersValue;
  dict: Dictionary["holidaysPage"];
}) {
  const router = useRouter();
  const pathname = usePathname();

  function applyFilters(next: Partial<Record<FilterKey, string>>) {
    const merged: Record<FilterKey, string> = {
      territoryId: filters.territoryId ?? "",
      year: filters.year ? String(filters.year) : "",
      ...next,
    };

    const params = new URLSearchParams();
    if (merged.territoryId) params.set("territoryId", merged.territoryId);
    if (merged.year) params.set("year", merged.year);

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function clearFilters() {
    router.push(pathname);
  }

  const hasActiveFilters = Boolean(filters.territoryId || filters.year);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="territoryId" className="text-sm font-medium">
          {dict.territoryLabel}
        </label>
        <Select
          items={[
            { value: "", label: dict.anyTerritory },
            ...territories.map((territory) => ({
              value: territory.id,
              label: `${territory.label} (${territory.code})`,
            })),
          ]}
          value={filters.territoryId ?? ""}
          onValueChange={(value) => applyFilters({ territoryId: value ?? "" })}
        >
          <SelectTrigger id="territoryId" className="w-80">
            <SelectValue placeholder={dict.anyTerritory} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{dict.anyTerritory}</SelectItem>
            {territories.map((territory) => (
              <SelectItem key={territory.id} value={territory.id}>
                {territory.label} ({territory.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="year" className="text-sm font-medium">
          {dict.yearLabel}
        </label>
        <Select
          items={[
            { value: "", label: dict.anyYear },
            ...years.map((year) => ({ value: String(year), label: String(year) })),
          ]}
          value={filters.year ? String(filters.year) : ""}
          onValueChange={(value) => applyFilters({ year: value ?? "" })}
        >
          <SelectTrigger id="year" className="w-28">
            <SelectValue placeholder={dict.anyYear} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{dict.anyYear}</SelectItem>
            {years.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
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
