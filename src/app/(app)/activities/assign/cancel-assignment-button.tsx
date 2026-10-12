"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
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

import { type ActivityFormState, cancelAssignmentAction } from "../actions";

// Cancels this one assignment — every other assignment on the same
// activity, if any, is untouched. Confirms first, same pattern as Routes'
// Cancel Current Assignment.
export function CancelAssignmentButton({
  assignmentId,
  dict,
}: {
  assignmentId: string;
  dict: Dictionary["activitiesPage"];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("assignmentId", assignmentId);
      const result: ActivityFormState = await cancelAssignmentAction({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(dict.assignmentCancelled);
      setOpen(false);
      router.push("/activities/assign");
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          />
        }
      >
        <Trash2 aria-hidden />
        {dict.cancelAssignmentAction}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dict.cancelAssignmentAction}</DialogTitle>
          <DialogDescription>{dict.cancelAssignmentConfirm}</DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>
            {dict.cancel}
          </DialogClose>
          <Button variant="destructive" disabled={isPending} onClick={confirm}>
            {dict.cancelAssignmentAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
