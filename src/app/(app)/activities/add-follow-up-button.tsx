"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { type ActivityFormState, createFollowUpAction } from "./actions";

export function AddFollowUpButton({
  activityId,
  dict,
}: {
  activityId: string;
  dict: Dictionary["activitiesPage"];
}) {
  const [open, setOpen] = useState(false);
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {dict.addFollowUp}
      </Button>
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("activityId", activityId);
      formData.set("dueDate", dueDate);
      const result: ActivityFormState = await createFollowUpAction({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(dict.followUpCreated);
      setOpen(false);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        className="h-8 w-36"
        value={dueDate}
        disabled={isPending}
        onChange={(e) => setDueDate(e.target.value)}
      />
      <Button type="button" size="sm" disabled={isPending} onClick={submit}>
        {isPending ? dict.saving : dict.save}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() => setOpen(false)}
      >
        {dict.cancel}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
