"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { SearchCombobox } from "@/components/search-combobox";
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
import { ROUTE_FILTER_STATUSES, type RouteFilters as RouteFiltersValue } from "@/lib/schemas/route";

import { statusLabel } from "../route-status";
import type { Assignee } from "./assign-form";

const ALL = "__all__";

// URL-driven filters for the routes table — same shape as the admin filter
// bars (e.g. admin/centers/center-filters.tsx): every change rebuilds the
// query string from scratch without `page`, so a filter change always lands
// on page 1, and the server re-runs the filtered, paginated query. The search
// box is debounced; the assignee is a server-side type-ahead like the form's.
export function RouteFilters({
  filters,
  assigneeLabel,
  dict,
}: {
  filters: RouteFiltersValue;
  // Display text for the assignee currently in the URL, resolved on the
  // server so a reload still shows who is selected.
  assigneeLabel: string | null;
  dict: Dictionary["routesPage"];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [q, setQ] = useState(filters.q ?? "");
  const [assignee, setAssignee] = useState<Assignee | null>(
    filters.assigneeId && assigneeLabel
      ? { id: filters.assigneeId, name: assigneeLabel, employeeCode: "", roleName: "" }
      : null,
  );
  // Bumped by "Clear filters" to remount the assignee combobox.
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function update(changes: Partial<Record<"q" | "assigneeId" | "status" | "from" | "to", string>>) {
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
    setAssignee(null);
    setResetKey((key) => key + 1);
    router.replace(pathname);
  }

  const anyFilter = Boolean(
    filters.q || filters.assigneeId || filters.status || filters.from || filters.to,
  );

  return (
    // One row on desktop — search, assignee, status, then the two compact
    // dates — wrapping cleanly onto more lines on smaller screens.
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

      <div className="min-w-0 flex-[2_1_100%] sm:flex-[2_1_14rem]">
        <SearchCombobox<Assignee>
          key={`assignee-filter-${resetKey}`}
          buildUrl={(query) => `/api/routes/assignees?q=${encodeURIComponent(query)}`}
          extract={(json) => (json as { users: Assignee[] }).users}
          getId={(item) => item.id}
          getLabel={(item) =>
            item.employeeCode ? `${item.name} (${item.employeeCode})` : item.name
          }
          renderItem={(item) => (
            <span className="flex min-w-0 flex-col">
              <span className="font-medium">{item.name}</span>
              <span className="text-xs text-muted-foreground">
                {item.employeeCode} · {item.roleName}
              </span>
            </span>
          )}
          value={assignee}
          onChange={(item) => {
            setAssignee(item);
            update({ assigneeId: item?.id ?? "" });
          }}
          placeholder={dict.filterAnyAssignee}
          emptyLabel={dict.noMatchingAssignees}
          loadingLabel={dict.searching}
          errorLabel={dict.searchFailed}
        />
      </div>

      <Select
        items={[
          { value: ALL, label: dict.filterAllStatuses },
          ...ROUTE_FILTER_STATUSES.map((status) => ({
            value: status,
            label: statusLabel(status, dict),
          })),
        ]}
        value={filters.status ?? ALL}
        onValueChange={(value) => update({ status: value && value !== ALL ? value : "" })}
      >
        <SelectTrigger className="w-full sm:w-44 sm:shrink-0" aria-label={dict.colStatus}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{dict.filterAllStatuses}</SelectItem>
          {ROUTE_FILTER_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {statusLabel(status, dict)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
