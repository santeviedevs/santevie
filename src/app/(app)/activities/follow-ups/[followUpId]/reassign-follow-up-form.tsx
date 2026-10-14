"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { SearchCombobox } from "@/components/search-combobox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { reassignFollowUpAction } from "../../actions";
import type { Assignee } from "../../assign/assign-activity-form";

type Dict = Dictionary["activitiesPage"];

// Reassigning a follow-up updates its owner in place — unlike assignment
// reassignment, it doesn't cancel/recreate anything, and it's independent
// of who the underlying assignment belongs to (see FollowUp.ownerId's
// schema comment). Offered only while this follow-up is still PENDING.
export function ReassignFollowUpForm({ followUpId, dict }: { followUpId: string; dict: Dict }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newOwner, setNewOwner] = useState<Assignee | null>(null);

  function submit() {
    setError(null);
    if (!newOwner) {
      setError(dict.assignFormIncomplete);
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", followUpId);
      formData.set("newOwnerId", newOwner.id);
      const result = await reassignFollowUpAction({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(dict.followUpReassigned);
      setNewOwner(null);
      router.refresh();
    });
  }

  return (
    <section className="flex max-w-sm flex-col gap-4" aria-labelledby="reassign-followup-heading">
      <h2 id="reassign-followup-heading" className="text-lg font-semibold">
        {dict.reassignFollowUpHeading}
      </h2>

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="followup-reassign-to">{dict.newOwnerLabel}</Label>
        <SearchCombobox<Assignee>
          inputId="followup-reassign-to"
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
          value={newOwner}
          onChange={setNewOwner}
          placeholder={dict.searchAssigneesPlaceholder}
          emptyLabel={dict.noMatchingAssignees}
          loadingLabel={dict.searching}
          errorLabel={dict.searchFailed}
          disabled={isPending}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="button" size="lg" className="w-full" disabled={isPending} onClick={submit}>
        {dict.reassignFollowUpHeading}
      </Button>
    </section>
  );
}
