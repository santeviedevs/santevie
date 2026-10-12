"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { SearchCombobox } from "@/components/search-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { type ActivityFormState, reassignAssignmentAction } from "../actions";
import type { Assignee } from "./assign-activity-form";

// Reassigning one specific assignment: cancels it and creates a fresh
// PLANNED one for the new user and date — every other assignment on the
// same activity, if any, is untouched. Offered only while this assignment
// is still PLANNED; the server refuses it otherwise regardless of what this
// screen shows, and re-checks the new assignee and duplicate assignments on
// every submit.
export function ReassignAssignmentForm({
  assignmentId,
  initialScheduledDate,
  dict,
}: {
  assignmentId: string;
  initialScheduledDate: string;
  dict: Dictionary["activitiesPage"];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [assignee, setAssignee] = useState<Assignee | null>(null);
  const [scheduledDate, setScheduledDate] = useState(initialScheduledDate);

  function submit() {
    setError(null);
    if (!assignee || !scheduledDate) {
      setError(dict.assignFormIncomplete);
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("assignmentId", assignmentId);
      formData.set("userId", assignee.id);
      formData.set("scheduledDate", scheduledDate);
      const result: ActivityFormState = await reassignAssignmentAction({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(dict.assignmentReassigned);
      router.push("/activities/assign");
    });
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="reassign-heading">
      <h2 id="reassign-heading" className="text-lg font-semibold">
        {dict.reassignHeading}
      </h2>

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="manage-reassign-to">{dict.assignToLabel}</Label>
        <SearchCombobox<Assignee>
          inputId="manage-reassign-to"
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
        <Label htmlFor="manage-reassign-date">{dict.colScheduledDate}</Label>
        <Input
          id="manage-reassign-date"
          type="date"
          value={scheduledDate}
          disabled={isPending}
          onChange={(e) => setScheduledDate(e.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="button" size="lg" className="w-full" disabled={isPending} onClick={submit}>
        {dict.reassignAction}
      </Button>
    </section>
  );
}
