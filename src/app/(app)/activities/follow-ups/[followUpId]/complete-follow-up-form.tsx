"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { completeFollowUpAction } from "../../actions";

type Dict = Dictionary["activitiesPage"];

// Outcome capture on completion — structured fields (prescriptions,
// business value, product availability), not just free text, so reports
// can later aggregate/filter on them (see completeFollowUpSchema). All
// optional: which ones are meaningful depends on the activity type this
// follow-up was raised against, so every field is offered rather than
// gated per type — an empty field is simply left null.
export function CompleteFollowUpForm({ followUpId, dict }: { followUpId: string; dict: Dict }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState("");
  const [prescriptionsGenerated, setPrescriptionsGenerated] = useState("");
  const [businessValueGenerated, setBusinessValueGenerated] = useState("");
  const [productAvailable, setProductAvailable] = useState<boolean | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", followUpId);
      if (outcome) formData.set("outcome", outcome);
      if (prescriptionsGenerated) formData.set("prescriptionsGenerated", prescriptionsGenerated);
      if (businessValueGenerated) formData.set("businessValueGenerated", businessValueGenerated);
      if (productAvailable !== null) {
        formData.set("productAvailable", productAvailable ? "true" : "false");
      }
      const result = await completeFollowUpAction({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(dict.followUpCompleted);
      router.refresh();
    });
  }

  return (
    <section className="flex max-w-sm flex-col gap-4" aria-labelledby="complete-followup-heading">
      <h2 id="complete-followup-heading" className="text-lg font-semibold">
        {dict.completeFollowUpAction}
      </h2>

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="followup-outcome">{dict.outcomeLabel}</Label>
        <Textarea
          id="followup-outcome"
          value={outcome}
          disabled={isPending}
          onChange={(e) => setOutcome(e.target.value)}
          rows={3}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="followup-prescriptions">{dict.prescriptionsGeneratedLabel}</Label>
        <Input
          id="followup-prescriptions"
          type="number"
          min={0}
          value={prescriptionsGenerated}
          disabled={isPending}
          onChange={(e) => setPrescriptionsGenerated(e.target.value)}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="followup-business-value">{dict.businessValueGeneratedLabel}</Label>
        <Input
          id="followup-business-value"
          type="number"
          min={0}
          step="0.01"
          value={businessValueGenerated}
          disabled={isPending}
          onChange={(e) => setBusinessValueGenerated(e.target.value)}
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <Checkbox
          checked={productAvailable === true}
          onCheckedChange={(checked) => setProductAvailable(checked === true)}
          disabled={isPending}
        />
        {dict.productAvailableLabel}
      </label>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="button" size="lg" className="w-full" disabled={isPending} onClick={submit}>
        {dict.completeFollowUpAction}
      </Button>
    </section>
  );
}
