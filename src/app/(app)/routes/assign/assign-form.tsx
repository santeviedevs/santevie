"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { SearchCombobox } from "@/components/search-combobox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { assignRouteAction, type RouteFormState } from "../actions";
import { DateRangeFields } from "./date-range-fields";

export type AssignableRoute = {
  id: string;
  code: string;
  centerCount: number;
  contactCount: number;
  centerNames: string[];
};
export type Assignee = { id: string; name: string; employeeCode: string; roleName: string };

// The compact assignment form above the table: Route, Assign To, Date Range
// and `+ Add`. Both dropdowns are server-side searches (bounded, scoped to
// what this user may assign) and the write is the assignRoute Server Action,
// which re-checks everything — eligibility, permission, dates, territory and
// duplicates — so nothing here is trusted. Only unassigned routes are ever
// offered; changing an existing assignment is the explicit Reassign action.
export function AssignForm({
  minDate,
  dict,
}: {
  // Today in Africa/Kinshasa (YYYY-MM-DD) — the earliest allowed start date.
  minDate: string;
  dict: Dictionary["routesPage"];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<AssignableRoute | null>(null);
  const [assignee, setAssignee] = useState<Assignee | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  // Bumped after a successful add to remount (and so clear) both dropdowns.
  const [resetKey, setResetKey] = useState(0);

  function add() {
    setError(null);
    if (!route || !assignee || !startDate || !endDate) {
      setError(dict.assignFormIncomplete);
      return;
    }
    if (endDate < startDate) {
      setError(dict.invalidDateRange);
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("routeId", route.id);
      formData.set("targetUserId", assignee.id);
      formData.set("startDate", startDate);
      formData.set("endDate", endDate);
      const result: RouteFormState = await assignRouteAction({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(dict.routeAssigned);
      setRoute(null);
      setAssignee(null);
      setStartDate("");
      setEndDate("");
      setResetKey((key) => key + 1);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-3 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_auto_auto] md:items-end">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="assign-route">{dict.routeFieldLabel}</Label>
          <SearchCombobox<AssignableRoute>
            key={`route-${resetKey}`}
            inputId="assign-route"
            buildUrl={(q) => `/api/routes/assignable-routes?q=${encodeURIComponent(q)}`}
            extract={(json) => (json as { routes: AssignableRoute[] }).routes}
            getId={(item) => item.id}
            getLabel={(item) => item.code}
            renderItem={(item) => (
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{item.code}</span>
                <span className="text-xs text-muted-foreground">
                  {item.centerCount} {dict.itemsCountSuffix} · {item.contactCount}{" "}
                  {dict.contactsCountSuffix}
                  {item.centerNames.length > 0 ? ` — ${item.centerNames.join(", ")}` : ""}
                </span>
              </span>
            )}
            value={route}
            onChange={setRoute}
            placeholder={dict.searchRoutesPlaceholder}
            emptyLabel={dict.noMatchingRoutes}
            loadingLabel={dict.searching}
            errorLabel={dict.searchFailed}
            disabled={isPending}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="assign-to">{dict.assignToLabel}</Label>
          <SearchCombobox<Assignee>
            key={`assignee-${resetKey}`}
            inputId="assign-to"
            buildUrl={(q) => `/api/routes/assignees?q=${encodeURIComponent(q)}`}
            extract={(json) => (json as { users: Assignee[] }).users}
            getId={(item) => item.id}
            getLabel={(item) => `${item.name} (${item.employeeCode})`}
            renderItem={(item) => (
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{item.name}</span>
                <span className="text-xs text-muted-foreground">
                  {item.employeeCode} · {item.roleName}
                </span>
              </span>
            )}
            value={assignee}
            onChange={setAssignee}
            placeholder={dict.searchAssigneesPlaceholder}
            emptyLabel={dict.noMatchingAssignees}
            loadingLabel={dict.searching}
            errorLabel={dict.searchFailed}
            disabled={isPending}
          />
        </div>

        <DateRangeFields
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          minDate={minDate}
          disabled={isPending}
          dict={dict}
        />

        <Button type="button" onClick={add} disabled={isPending} className="w-full md:w-auto">
          {dict.addAction}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
