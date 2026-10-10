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

import { cancelRouteAssignmentAction, type RouteFormState } from "../actions";

// "Cancel Current Assignment" in the page header: a secondary danger action
// that asks for confirmation first. Confirming runs the existing
// cancelRouteAssignment Server Action, which cancels the still-pending
// visits and records the history — it never deletes the route, completed
// work or earlier history, and every authorization and rule check still
// happens on the server.
export function CancelAssignmentButton({
  routeId,
  dict,
}: {
  routeId: string;
  dict: Dictionary["routesPage"];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("routeId", routeId);
      const result: RouteFormState = await cancelRouteAssignmentAction({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(dict.assignmentCancelled);
      setOpen(false);
      router.push("/routes/assign");
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
        {dict.cancelCurrentAssignment}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dict.cancelDialogTitle}</DialogTitle>
          <DialogDescription>{dict.cancelDialogBody}</DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>
            {dict.cancelDialogKeep}
          </DialogClose>
          <Button variant="destructive" disabled={isPending} onClick={confirm}>
            {dict.cancelAssignment}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
