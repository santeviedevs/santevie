"use client";

import { usePathname, useRouter } from "next/navigation";

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
import type { LeaveFilters as LeaveFiltersValue } from "@/lib/schemas/leave";

type FilterKey = "leaveTypeId" | "status" | "from" | "to" | "employeeId" | "territoryId";

// Shared by My Leaves and Team Leaves — same fields, only the underlying
// query's scope (own id vs. downstream team) differs, which is handled
// server-side in leave-service.ts, not here. This component only translates
// a change into a URL update; the actual filtering happens server-side on
// the next render (see leaveFiltersSchema.parse in each page), same pattern
// as TerritoryFilters/TeamFilters.
//
// employees/territories are omitted (undefined) on My Leaves, where every
// row already belongs to the viewer and "which territory" rarely narrows
// anything meaningful — only Team Leaves passes them.
export function LeaveFilters({
  leaveTypes,
  employees,
  territories,
  filters,
  dict,
  territoryDict,
}: {
  leaveTypes: { id: string; name: string }[];
  employees?: { id: string; name: string; employeeCode: string }[];
  territories?: { id: string; code: string; label: string }[];
  filters: LeaveFiltersValue;
  dict: Dictionary["leavesPage"];
  territoryDict?: Dictionary["territory"];
}) {
  const router = useRouter();
  const pathname = usePathname();

  function applyFilters(next: Partial<Record<FilterKey, string>>) {
    const merged: Record<FilterKey, string> = {
      leaveTypeId: filters.leaveTypeId ?? "",
      status: filters.status ?? "",
      from: filters.from ?? "",
      to: filters.to ?? "",
      employeeId: filters.employeeId ?? "",
      territoryId: filters.territoryId ?? "",
      ...next,
    };

    const params = new URLSearchParams();
    if (merged.leaveTypeId) params.set("leaveTypeId", merged.leaveTypeId);
    if (merged.status) params.set("status", merged.status);
    if (merged.from) params.set("from", merged.from);
    if (merged.to) params.set("to", merged.to);
    if (merged.employeeId) params.set("employeeId", merged.employeeId);
    if (merged.territoryId) params.set("territoryId", merged.territoryId);

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function clearFilters() {
    router.push(pathname);
  }

  const hasActiveFilters = Boolean(
    filters.leaveTypeId ||
    filters.status ||
    filters.from ||
    filters.to ||
    filters.employeeId ||
    filters.territoryId,
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      {employees ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="employeeId" className="text-xs text-muted-foreground">
            {dict.filterEmployee}
          </label>
          <Select
            items={[
              { value: "", label: dict.filterAnyEmployee },
              ...employees.map((employee) => ({
                value: employee.id,
                label: `${employee.name} (${employee.employeeCode})`,
              })),
            ]}
            value={filters.employeeId ?? ""}
            onValueChange={(value) => applyFilters({ employeeId: value ?? "" })}
          >
            <SelectTrigger id="employeeId" className="w-52">
              <SelectValue placeholder={dict.filterAnyEmployee} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{dict.filterAnyEmployee}</SelectItem>
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.name} ({employee.employeeCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {territories ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="territoryId" className="text-xs text-muted-foreground">
            {territoryDict?.territoryFilterLabel}
          </label>
          <Select
            items={[
              { value: "", label: territoryDict?.anyTerritoryFilter ?? "" },
              ...territories.map((territory) => ({
                value: territory.id,
                label: `${territory.label} (${territory.code})`,
              })),
            ]}
            value={filters.territoryId ?? ""}
            onValueChange={(value) => applyFilters({ territoryId: value ?? "" })}
          >
            <SelectTrigger id="territoryId" className="w-80">
              <SelectValue placeholder={territoryDict?.anyTerritoryFilter} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{territoryDict?.anyTerritoryFilter}</SelectItem>
              {territories.map((territory) => (
                <SelectItem key={territory.id} value={territory.id}>
                  {territory.label} ({territory.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="leaveTypeId" className="text-xs text-muted-foreground">
          {dict.filterLeaveType}
        </label>
        <Select
          items={[
            { value: "", label: dict.filterAnyLeaveType },
            ...leaveTypes.map((type) => ({ value: type.id, label: type.name })),
          ]}
          value={filters.leaveTypeId ?? ""}
          onValueChange={(value) => applyFilters({ leaveTypeId: value ?? "" })}
        >
          <SelectTrigger id="leaveTypeId" className="w-44">
            <SelectValue placeholder={dict.filterAnyLeaveType} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{dict.filterAnyLeaveType}</SelectItem>
            {leaveTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="status" className="text-xs text-muted-foreground">
          {dict.filterStatus}
        </label>
        <Select
          items={[
            { value: "", label: dict.filterAnyStatus },
            { value: "PENDING", label: dict.statusPending },
            { value: "APPROVED", label: dict.statusApproved },
            { value: "REJECTED", label: dict.statusRejected },
          ]}
          value={filters.status ?? ""}
          onValueChange={(value) => applyFilters({ status: value ?? "" })}
        >
          <SelectTrigger id="status" className="w-36">
            <SelectValue placeholder={dict.filterAnyStatus} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{dict.filterAnyStatus}</SelectItem>
            <SelectItem value="PENDING">{dict.statusPending}</SelectItem>
            <SelectItem value="APPROVED">{dict.statusApproved}</SelectItem>
            <SelectItem value="REJECTED">{dict.statusRejected}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="from" className="text-xs text-muted-foreground">
          {dict.filterFrom}
        </label>
        {/* Controlled by `filters.from`, not defaultValue — a defaultValue
            only applies at mount, so "Clear filters" (a route change, not a
            remount) would leave a stale typed date on screen even though the
            URL no longer carries it. */}
        <Input
          id="from"
          type="date"
          value={filters.from ?? ""}
          onChange={(event) => applyFilters({ from: event.target.value })}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="to" className="text-xs text-muted-foreground">
          {dict.filterTo}
        </label>
        <Input
          id="to"
          type="date"
          value={filters.to ?? ""}
          onChange={(event) => applyFilters({ to: event.target.value })}
        />
      </div>

      {hasActiveFilters ? (
        <Button type="button" variant="ghost" onClick={clearFilters}>
          {dict.clearFilters}
        </Button>
      ) : null}
    </div>
  );
}
