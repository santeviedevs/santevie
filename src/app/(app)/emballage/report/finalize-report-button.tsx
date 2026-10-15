"use client";

import { Lock } from "lucide-react";
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

import { type EmballageFormState, finalizeEmballageReportAction } from "../actions";

type Dict = Dictionary["emballagePage"];

// Locks every collection row in the given month and records the
// EmballageReportRun, in one transaction — confirms first, since it's a
// one-way action (re-finalizing an already-finalized month is rejected by
// the service, not silently re-run).
export function FinalizeReportButton({
  periodMonth,
  periodYear,
  dict,
}: {
  periodMonth: number;
  periodYear: number;
  dict: Dict;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("periodMonth", String(periodMonth));
      formData.set("periodYear", String(periodYear));
      const result: EmballageFormState = await finalizeEmballageReportAction(
        { error: null },
        formData,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(dict.reportFinalized);
      setOpen(false);
      router.refresh();
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
      <DialogTrigger render={<Button variant="outline" />}>
        <Lock aria-hidden />
        {dict.finalizeReport}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dict.finalizeConfirmTitle}</DialogTitle>
          <DialogDescription>{dict.finalizeConfirmBody}</DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>
            {dict.cancel}
          </DialogClose>
          <Button disabled={isPending} onClick={confirm}>
            {dict.finalizeConfirmAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
