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
import { ACTIVITY_ASSIGNMENT_STATUSES } from "@/lib/schemas/activity";

const ALL = "__all__";

export type AssigneeOption = { id: string; name: string; employeeCode: string; roleName: string };
export type ActivityTypeOption = { id: string; name: string };

type Dict = Dictionary["activitiesPage"];

function statusLabel(status: string, dict: Dict): string {
  if (status === "PLANNED") return dict.statusPlanned;
  if (status === "DONE") return dict.statusDone;
  return dict.statusCancelled;
}

// URL-driven filters, same shape as RouteFilters: every change rebuilds the
// query string from scratch without `page`, so a filter change always lands
// on page 1. Shared by the Activity List (no assignee filter) and the
// Assignment table (`showAssignee`), same split as RouteFilters' `showStatus`.
export function ActivityFilters({
  filters,
  assigneeLabel,
  showAssignee = false,
  typeOptions,
  dict,
}: {
  filters: {
    q?: string;
    typeId?: string;
    status?: string;
    assigneeId?: string;
    from?: string;
    to?: string;
  };
  assigneeLabel?: string | null;
  showAssignee?: boolean;
  typeOptions: ActivityTypeOption[];
  dict: Dict;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [q, setQ] = useState(filters.q ?? "");
  const [assignee, setAssignee] = useState<AssigneeOption | null>(
    filters.assigneeId && assigneeLabel
      ? { id: filters.assigneeId, name: assigneeLabel, employeeCode: "", roleName: "" }
      : null,
  );
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function update(
    changes: Partial<Record<"q" | "typeId" | "status" | "assigneeId" | "from" | "to", string>>,
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
    setAssignee(null);
    setResetKey((key) => key + 1);
    router.replace(pathname);
  }

  const anyFilter = Boolean(
    filters.q ||
    filters.typeId ||
    filters.status ||
    (showAssignee && filters.assigneeId) ||
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

      {showAssignee ? (
        <div className="min-w-0 flex-[2_1_100%] sm:flex-[2_1_14rem]">
          <SearchCombobox<AssigneeOption>
            key={`assignee-filter-${resetKey}`}
            buildUrl={(query) => `/api/activities/assignees?q=${encodeURIComponent(query)}`}
            extract={(json) => (json as { users: AssigneeOption[] }).users}
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
            placeholder={dict.searchAssigneesPlaceholder}
            emptyLabel={dict.noMatchingAssignees}
            loadingLabel={dict.searching}
            errorLabel={dict.searchFailed}
          />
        </div>
      ) : null}

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
          ...ACTIVITY_ASSIGNMENT_STATUSES.map((status) => ({
            value: status,
            label: statusLabel(status, dict),
          })),
        ]}
        value={filters.status ?? ALL}
        onValueChange={(value) => update({ status: value && value !== ALL ? value : "" })}
      >
        <SelectTrigger className="w-full sm:w-40 sm:shrink-0" aria-label={dict.colStatus}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{dict.filterAllStatuses}</SelectItem>
          {ACTIVITY_ASSIGNMENT_STATUSES.map((status) => (
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
