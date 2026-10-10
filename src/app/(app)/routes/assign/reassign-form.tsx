"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { SearchCombobox } from "@/components/search-combobox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { assignRouteAction, reassignRouteAction, type RouteFormState } from "../actions";
import type { Assignee } from "./assign-form";
import { DateRangeFields } from "./date-range-fields";

// The Reassign Route section of the Manage page: who, and for which dates.
// An assigned route is reassigned in place (same route, same code, same
// items — see reassignRoute); a route nobody holds yet is assigned instead
// (the page is also reachable directly for those). Offered only while there
// is something pending and, for reassignment, nothing completed; the server
// refuses it otherwise regardless of what this screen shows, and re-checks
// the assignee, dates, territory and conflicts on every submit.
export function ReassignForm({
  routeId,
  isAssigned,
  minDate,
  initialStartDate,
  initialEndDate,
  dict,
}: {
  routeId: string;
  isAssigned: boolean;
  minDate: string;
  initialStartDate: string;
  initialEndDate: string;
  dict: Dictionary["routesPage"];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [assignee, setAssignee] = useState<Assignee | null>(null);
  // An existing range already in the past can't be re-submitted as-is (the
  // start must be today or later), so it only pre-fills while still valid.
  const prefill = initialStartDate !== "" && initialStartDate >= minDate;
  const [startDate, setStartDate] = useState(prefill ? initialStartDate : "");
  const [endDate, setEndDate] = useState(prefill ? initialEndDate : "");

  function submit() {
    setError(null);
    if (!assignee || !startDate || !endDate) {
      setError(dict.assignFormIncomplete);
      return;
    }
    if (endDate < startDate) {
      setError(dict.invalidDateRange);
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("routeId", routeId);
      formData.set("targetUserId", assignee.id);
      formData.set("startDate", startDate);
      formData.set("endDate", endDate);
      const action = isAssigned ? reassignRouteAction : assignRouteAction;
      const result: RouteFormState = await action({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(isAssigned ? dict.routeReassigned : dict.routeAssigned);
      router.push("/routes/assign");
    });
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="reassign-heading">
      <div className="flex flex-col gap-1">
        <h2 id="reassign-heading" className="text-lg font-semibold">
          {isAssigned ? dict.reassignRouteHeading : dict.assignRouteHeading}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isAssigned ? dict.reassignRouteHelp : dict.assignRouteHelp}
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="manage-assign-to">{dict.assignToLabel}</Label>
        <SearchCombobox<Assignee>
          inputId="manage-assign-to"
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
        labelled
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        minDate={minDate}
        disabled={isPending}
        dict={dict}
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="button" size="lg" className="w-full" disabled={isPending} onClick={submit}>
        {isAssigned ? dict.reassignAction : dict.assignAction}
      </Button>
    </section>
  );
}
