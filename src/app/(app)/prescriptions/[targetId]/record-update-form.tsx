"use client";

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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { recordPrescriptionUpdateAction, type RecordPrescriptionUpdateFormState } from "../actions";

type Dict = Dictionary["prescriptionsPage"];

// dict.decreaseConfirmBody is a plain string template ("{current}"/"{next}"
// placeholders), not a function — a function can't be part of the dict
// object this component receives as a server-to-client prop. Interpolated
// here instead.
function formatDecreaseConfirmBody(template: string, current: number, next: number): string {
  return template.replace("{current}", String(current)).replace("{next}", String(next));
}

// Records a new cumulative value for a target — append-only, never edits a
// past PrescriptionUpdate row. A submission that comes back lower than the
// server's current latest value doesn't fail outright: the action returns
// needsDecreaseConfirmation with the *server-verified* current value (never
// the one this page loaded with, which could be stale if someone else
// updated it since), and this form opens a dialog requiring both an
// explicit confirmation and a non-blank correction reason before
// resubmitting with confirmDecrease: true. Both checks are re-enforced
// server-side regardless of what this dialog does.
export function RecordUpdateForm({ targetId, dict }: { targetId: string; dict: Dict }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cumulativeAchieved, setCumulativeAchieved] = useState("");
  const [feedback, setFeedback] = useState("");
  const [challenges, setChallenges] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [decreaseDialog, setDecreaseDialog] = useState<{ currentAchieved: number } | null>(null);

  function submit(confirmDecrease: boolean) {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("targetId", targetId);
      formData.set("cumulativeAchieved", cumulativeAchieved);
      if (feedback) formData.set("feedback", feedback);
      if (challenges) formData.set("challenges", challenges);
      if (followUpDate) formData.set("followUpDate", followUpDate);
      formData.set("confirmDecrease", confirmDecrease ? "true" : "false");
      if (confirmDecrease && correctionReason) {
        formData.set("correctionReason", correctionReason);
      }

      const result: RecordPrescriptionUpdateFormState = await recordPrescriptionUpdateAction(
        { error: null },
        formData,
      );

      if (result.needsDecreaseConfirmation) {
        setDecreaseDialog({ currentAchieved: result.currentAchieved ?? 0 });
        if (result.error) setError(result.error);
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success(dict.updateRecorded);
      setDecreaseDialog(null);
      setFeedback("");
      setChallenges("");
      setFollowUpDate("");
      setCorrectionReason("");
      router.refresh();
    });
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    submit(false);
  }

  const enteredValue = Number(cumulativeAchieved);

  return (
    <>
      <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cumulativeAchieved">{dict.cumulativeAchievedLabel}</Label>
          <Input
            id="cumulativeAchieved"
            type="number"
            min="0"
            step="1"
            disabled={isPending}
            value={cumulativeAchieved}
            onChange={(e) => setCumulativeAchieved(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="feedback">{dict.feedbackLabel}</Label>
          <Textarea
            id="feedback"
            disabled={isPending}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="challenges">{dict.challengesLabel}</Label>
          <Textarea
            id="challenges"
            disabled={isPending}
            value={challenges}
            onChange={(e) => setChallenges(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="followUpDate">{dict.followUpDateLabel}</Label>
          <Input
            id="followUpDate"
            type="date"
            disabled={isPending}
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
          />
        </div>

        {error && !decreaseDialog ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="submit" disabled={isPending || !cumulativeAchieved}>
          {isPending ? dict.recording : dict.recordUpdate}
        </Button>
      </form>

      <Dialog
        open={decreaseDialog !== null}
        onOpenChange={(open) => {
          if (!open) setDecreaseDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dict.decreaseConfirmTitle}</DialogTitle>
            <DialogDescription>
              {decreaseDialog
                ? formatDecreaseConfirmBody(
                    dict.decreaseConfirmBody,
                    decreaseDialog.currentAchieved,
                    enteredValue,
                  )
                : null}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="correctionReason">{dict.correctionReasonLabel}</Label>
            <Textarea
              id="correctionReason"
              disabled={isPending}
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              required
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={isPending} />}>
              {dict.cancel}
            </DialogClose>
            <Button disabled={isPending || !correctionReason} onClick={() => submit(true)}>
              {dict.confirmAndSave}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
