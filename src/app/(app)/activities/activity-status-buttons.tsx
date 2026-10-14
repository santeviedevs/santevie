"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { type ActivityFormState, updateAssignmentStatusAction } from "./actions";

// The assignee's way to respond: mark their planned assignment done or
// cancel it. Only rendered for a PLANNED assignment the viewer holds (or,
// for a manager, manages) — the server re-checks both.
//
// "Mark done" is gated on `executionRecorded` (has the delegate ever saved
// the execution form for this assignment — see the schema comment on
// ActivityAssignment.executionRecordedAt) and always confirms first:
// completing finalizes the assignment and, for a configured type, silently
// creates its auto-follow-up(s) from whatever execution data exists at that
// moment (e.g. RTM fans out one follow-up per participant marked present —
// nothing to fan out from if nobody ever was). Both the disabled hint and
// the dialog exist because that failure mode was confirmed happening in
// practice, not hypothetically.
export function ActivityStatusButtons({
  assignmentId,
  executionRecorded,
  dict,
}: {
  assignmentId: string;
  executionRecorded: boolean;
  dict: Dictionary["activitiesPage"];
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update(status: "DONE" | "CANCELLED") {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("assignmentId", assignmentId);
      formData.set("status", status);
      const result: ActivityFormState = await updateAssignmentStatusAction(
        { error: null },
        formData,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(dict.activityUpdated);
      if (status === "DONE") setConfirmOpen(false);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger render={<Button type="button" size="sm" disabled={!executionRecorded} />}>
            {dict.markActivityDone}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{dict.markDoneConfirmTitle}</DialogTitle>
              <DialogDescription>{dict.markDoneConfirmDescription}</DialogDescription>
            </DialogHeader>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" disabled={isPending} />}>
                {dict.cancel}
              </DialogClose>
              <Button disabled={isPending} onClick={() => update("DONE")}>
                {dict.markActivityDone}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isPending}
          onClick={() => update("CANCELLED")}
        >
          {dict.markActivityCancelled}
        </Button>
      </div>
      {!executionRecorded ? (
        <p className="text-xs text-muted-foreground">{dict.executionNotRecordedHint}</p>
      ) : null}
      {error && !confirmOpen ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
