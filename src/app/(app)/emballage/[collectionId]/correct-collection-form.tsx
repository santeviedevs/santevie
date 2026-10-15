"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { correctEmballageCollectionAction, type EmballageFormState } from "../actions";

type Dict = Dictionary["emballagePage"];

// Corrects the row's quantity in place (never a negative offset row) and
// writes one audit entry alongside it — see EmballageCorrection in
// schema.prisma. Offered to the owning delegate while unlocked, or to a
// manager with emballage:correct-locked once the month has been finalized
// — the page decides which case applies before rendering this.
export function CorrectCollectionForm({
  collectionId,
  currentQuantity,
  dict,
}: {
  collectionId: string;
  currentQuantity: string;
  dict: Dict;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(currentQuantity);
  const [reason, setReason] = useState("");

  function submit() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", collectionId);
      formData.set("quantity", quantity);
      if (reason) formData.set("reason", reason);

      const result: EmballageFormState = await correctEmballageCollectionAction(
        { error: null },
        formData,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(dict.correctionSaved);
      router.refresh();
    });
  }

  return (
    <section className="flex max-w-sm flex-col gap-4" aria-labelledby="correct-collection-heading">
      <h2 id="correct-collection-heading" className="text-lg font-semibold">
        {dict.correctAction}
      </h2>

      <div className="flex flex-col gap-2">
        <Label htmlFor="correctedQuantity">{dict.newQuantityLabel}</Label>
        <Input
          id="correctedQuantity"
          type="number"
          min="0.01"
          step="0.01"
          disabled={isPending}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="correctionReason">{dict.correctionReasonLabel}</Label>
        <Input
          id="correctionReason"
          disabled={isPending}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="button" disabled={isPending || !quantity} onClick={submit}>
        {isPending ? dict.saving : dict.correctAction}
      </Button>
    </section>
  );
}
