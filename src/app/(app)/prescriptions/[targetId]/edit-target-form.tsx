"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { type PrescriptionTargetFormState, updatePrescriptionTargetAction } from "../actions";

type Dict = Dictionary["prescriptionsPage"];

// Edits monthlyTarget on an existing target — writes a
// PrescriptionTargetRevision audit row whenever the value actually changes
// (same convention as Emballage's correction form). Manager-facing only;
// the page decides whether to render this before passing control here.
export function EditTargetForm({
  targetId,
  currentMonthlyTarget,
  dict,
}: {
  targetId: string;
  currentMonthlyTarget: number;
  dict: Dict;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [monthlyTarget, setMonthlyTarget] = useState(String(currentMonthlyTarget));
  const [reason, setReason] = useState("");

  function submit() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", targetId);
      formData.set("monthlyTarget", monthlyTarget);
      if (reason) formData.set("reason", reason);

      const result: PrescriptionTargetFormState = await updatePrescriptionTargetAction(
        { error: null },
        formData,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(dict.targetUpdated);
      setReason("");
      router.refresh();
    });
  }

  return (
    <section className="flex max-w-sm flex-col gap-4" aria-labelledby="edit-target-heading">
      <h2 id="edit-target-heading" className="text-lg font-semibold">
        {dict.editTarget}
      </h2>

      <div className="flex flex-col gap-2">
        <Label htmlFor="editMonthlyTarget">{dict.monthlyTargetLabel}</Label>
        <Input
          id="editMonthlyTarget"
          type="number"
          min="1"
          step="1"
          disabled={isPending}
          value={monthlyTarget}
          onChange={(e) => setMonthlyTarget(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="editReason">{dict.editReasonLabel}</Label>
        <Input
          id="editReason"
          disabled={isPending}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="button" disabled={isPending || !monthlyTarget} onClick={submit}>
        {isPending ? dict.saving : dict.save}
      </Button>
    </section>
  );
}
