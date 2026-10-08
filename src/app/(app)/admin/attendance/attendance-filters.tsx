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
import type { AttendanceReportFilters } from "@/lib/schemas/attendance-report";

type FilterKey = "employeeId" | "territoryId" | "dateFrom" | "dateTo" | "status";

const STATUSES = ["PRESENT", "LATE", "INCOMPLETE", "ABSENT", "NON_WORKING", "NEEDS_REVIEW"];

// Same client-updates-URL / server-filters pattern as HolidayFilters.
export function AttendanceFilters({
  employees,
  territories,
  filters,
  dict,
}: {
  employees: { id: string; label: string }[];
  territories: { id: string; label: string }[];
  filters: AttendanceReportFilters;
  dict: Dictionary["attendanceAdminPage"];
}) {
  const router = useRouter();
  const pathname = usePathname();

  function applyFilters(next: Partial<Record<FilterKey, string>>) {
    const merged: Record<FilterKey, string> = {
      employeeId: filters.employeeId ?? "",
      territoryId: filters.territoryId ?? "",
      dateFrom: filters.dateFrom ?? "",
      dateTo: filters.dateTo ?? "",
      status: filters.status ?? "",
      ...next,
    };

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function clearFilters() {
    router.push(pathname);
  }

  const hasActiveFilters = Boolean(
    filters.employeeId ||
    filters.territoryId ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.status,
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="employeeId" className="text-sm font-medium">
          {dict.employeeLabel}
        </label>
        <Select
          items={[
            { value: "", label: dict.anyEmployee },
            ...employees.map((e) => ({ value: e.id, label: e.label })),
          ]}
          value={filters.employeeId ?? ""}
          onValueChange={(value) => applyFilters({ employeeId: value ?? "" })}
        >
          <SelectTrigger id="employeeId" className="w-56">
            <SelectValue placeholder={dict.anyEmployee} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{dict.anyEmployee}</SelectItem>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="territoryId" className="text-sm font-medium">
          {dict.territoryLabel}
        </label>
        <Select
          items={[
            { value: "", label: dict.anyTerritory },
            ...territories.map((t) => ({ value: t.id, label: t.label })),
          ]}
          value={filters.territoryId ?? ""}
          onValueChange={(value) => applyFilters({ territoryId: value ?? "" })}
        >
          <SelectTrigger id="territoryId" className="w-56">
            <SelectValue placeholder={dict.anyTerritory} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{dict.anyTerritory}</SelectItem>
            {territories.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="dateFrom" className="text-sm font-medium">
          {dict.dateFromLabel}
        </label>
        <Input
          id="dateFrom"
          type="date"
          className="w-40"
          value={filters.dateFrom ?? ""}
          onChange={(e) => applyFilters({ dateFrom: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="dateTo" className="text-sm font-medium">
          {dict.dateToLabel}
        </label>
        <Input
          id="dateTo"
          type="date"
          className="w-40"
          value={filters.dateTo ?? ""}
          onChange={(e) => applyFilters({ dateTo: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="status" className="text-sm font-medium">
          {dict.statusLabel}
        </label>
        <Select
          items={[
            { value: "", label: dict.anyStatus },
            ...STATUSES.map((s) => ({ value: s, label: s })),
          ]}
          value={filters.status ?? ""}
          onValueChange={(value) => applyFilters({ status: value ?? "" })}
        >
          <SelectTrigger id="status" className="w-44">
            <SelectValue placeholder={dict.anyStatus} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{dict.anyStatus}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
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
