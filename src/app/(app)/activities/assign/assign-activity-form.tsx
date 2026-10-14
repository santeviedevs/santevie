"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { SearchCombobox } from "@/components/search-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { type ActivityFormState, createAssignmentAction } from "../actions";

export type AssignableActivity = {
  id: string;
  name: string;
  type: { id: string; code: string; name: string };
  assignmentCount: number;
};
export type Assignee = { id: string; name: string; employeeCode: string; roleName: string };

type Dict = Dictionary["activitiesPage"];

// The compact assignment form above the table: Activity, Assign To, `+ Add`.
// Both dropdowns are server-side searches scoped to what this user may
// assign; the write is the createAssignment Server Action, which
// re-validates everything (scope, active status, no duplicate active
// assignment), so nothing here is trusted. Not narrowed to "unassigned
// activities only" — more than one person can be assigned to the same
// activity at once.
export function AssignActivityForm({ dict }: { dict: Dict }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<AssignableActivity | null>(null);
  const [assignee, setAssignee] = useState<Assignee | null>(null);
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [resetKey, setResetKey] = useState(0);

  function add() {
    setError(null);
    if (!activity || !assignee || !scheduledDate) {
      setError(dict.assignFormIncomplete);
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("activityId", activity.id);
      formData.set("userId", assignee.id);
      formData.set("scheduledDate", scheduledDate);
      const result: ActivityFormState = await createAssignmentAction({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(dict.activityAssigned);
      setActivity(null);
      setAssignee(null);
      setScheduledDate(new Date().toISOString().slice(0, 10));
      setResetKey((key) => key + 1);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-3 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_auto_auto] md:items-end">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="assign-activity">{dict.activityFieldLabel}</Label>
          <SearchCombobox<AssignableActivity>
            key={`activity-${resetKey}`}
            inputId="assign-activity"
            buildUrl={(q) => `/api/activities/assignable-activities?q=${encodeURIComponent(q)}`}
            extract={(json) => (json as { activities: AssignableActivity[] }).activities}
            getId={(item) => item.id}
            getLabel={(item) => item.name}
            renderItem={(item) => (
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{item.name}</span>
                <span className="text-xs text-muted-foreground">
                  {item.type.name}
                  {item.assignmentCount > 0
                    ? ` — ${item.assignmentCount} ${dict.colAssignees.toLowerCase()}`
                    : ""}
                </span>
              </span>
            )}
            value={activity}
            onChange={setActivity}
            placeholder={dict.searchActivitiesPlaceholder}
            emptyLabel={dict.noMatchingActivities}
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
            buildUrl={(q) => `/api/activities/assignees?q=${encodeURIComponent(q)}`}
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

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="assign-date">{dict.colScheduledDate}</Label>
          <Input
            id="assign-date"
            type="date"
            value={scheduledDate}
            disabled={isPending}
            onChange={(e) => setScheduledDate(e.target.value)}
          />
        </div>

        <Button type="button" onClick={add} disabled={isPending} className="w-full md:w-auto">
          {dict.addAction}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
