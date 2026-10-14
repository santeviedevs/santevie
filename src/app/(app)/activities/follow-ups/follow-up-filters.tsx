"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Dictionary } from "@/lib/i18n/dictionary";

const ALL = "__all__";

export type FollowUpTypeOption = { id: string; name: string };

type Dict = Dictionary["activitiesPage"];

// URL-driven filters, same pattern as ActivityFilters: every change rebuilds
// the query string from scratch without `page`, so a filter change always
// lands on page 1.
export function FollowUpFilters({
  filters,
  typeOptions,
  dict,
}: {
  filters: {
    q?: string;
    typeId?: string;
    status?: string;
    overdueOnly?: boolean;
    from?: string;
    to?: string;
  };
  typeOptions: FollowUpTypeOption[];
  dict: Dict;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [q, setQ] = useState(filters.q ?? "");

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function update(
    changes: Partial<Record<"q" | "typeId" | "status" | "overdueOnly" | "from" | "to", string>>,
  ) {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("page");
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function clear() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQ("");
    router.replace(pathname);
  }

  const anyFilter = Boolean(
    filters.q ||
    filters.typeId ||
    filters.status ||
    filters.overdueOnly ||
    filters.from ||
    filters.to,
  );

  return (
    <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap">
      <Input
        type="search"
        value={q}
        placeholder={dict.filterSearchPlaceholder}
        aria-label={dict.filterSearchPlaceholder}
        className="min-w-0 flex-[2_1_100%] sm:flex-[2_1_14rem]"
        onChange={(event) => {
          const value = event.target.value;
          setQ(value);
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => update({ q: value.trim() }), 300);
        }}
      />

      <Select
        items={[
          { value: ALL, label: dict.filterAllTypes },
          ...typeOptions.map((type) => ({ value: type.id, label: type.name })),
        ]}
        value={filters.typeId ?? ALL}
        onValueChange={(value) => update({ typeId: value && value !== ALL ? value : "" })}
      >
        <SelectTrigger className="w-full sm:w-40 sm:shrink-0" aria-label={dict.typeLabel}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{dict.filterAllTypes}</SelectItem>
          {typeOptions.map((type) => (
            <SelectItem key={type.id} value={type.id}>
              {type.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={[
          { value: ALL, label: dict.filterAllStatuses },
          { value: "PENDING", label: dict.followUpStatusPending },
          { value: "DONE", label: dict.followUpStatusDone },
        ]}
        value={filters.status ?? ALL}
        disabled={filters.overdueOnly}
        onValueChange={(value) => update({ status: value && value !== ALL ? value : "" })}
      >
        <SelectTrigger className="w-full sm:w-36 sm:shrink-0" aria-label={dict.colStatus}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{dict.filterAllStatuses}</SelectItem>
          <SelectItem value="PENDING">{dict.followUpStatusPending}</SelectItem>
          <SelectItem value="DONE">{dict.followUpStatusDone}</SelectItem>
        </SelectContent>
      </Select>

      {/* Overdue is inherently a PENDING concept — checking it overrides
          whatever status is selected (see FollowUpQuery.overdueOnly), so it
          also clears the status filter here to keep the UI honest about
          what's actually being applied. */}
      <label className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
        <Checkbox
          checked={filters.overdueOnly ?? false}
          onCheckedChange={(checked) =>
            update({ overdueOnly: checked === true ? "true" : "", status: "" })
          }
        />
        {dict.filterOverdueOnly}
      </label>

      <label className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
        {dict.filterFrom}
        <Input
          type="date"
          value={filters.from ?? ""}
          onChange={(event) => update({ from: event.target.value })}
          className="w-36"
        />
      </label>
      <label className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
        {dict.filterTo}
        <Input
          type="date"
          value={filters.to ?? ""}
          min={filters.from}
          onChange={(event) => update({ to: event.target.value })}
          className="w-36"
        />
      </label>

      {anyFilter ? (
        <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={clear}>
          {dict.filterClear}
        </Button>
      ) : null}
    </div>
  );
}
