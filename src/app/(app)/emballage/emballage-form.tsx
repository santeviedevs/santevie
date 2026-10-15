"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { createEmballageCollectionAction, type EmballageFormState } from "./actions";

type Option = { id: string; label: string };
type Dict = Dictionary["emballagePage"];

// Logs one collection event — centre, product, date, quantity, remarks.
// Deliberately no edit of an already-submitted row from here: the same
// centre/product/date can (and should) be logged again on a separate
// visit, each its own row — see the brief in Marketing Activity.md §3.6.
// Correcting a genuine mistake on an existing row happens from the
// collection's own detail page instead (controlled correction, §2.2's
// agreed design), not by resubmitting this form.
export function EmballageForm({
  centers,
  products,
  dict,
}: {
  centers: Option[];
  products: Option[];
  dict: Dict;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const [centerId, setCenterId] = useState(centers[0]?.id ?? "");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [visitDate, setVisitDate] = useState(today);
  const [quantity, setQuantity] = useState("");
  const [remarks, setRemarks] = useState("");

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("centerId", centerId);
      formData.set("productId", productId);
      formData.set("visitDate", visitDate);
      formData.set("quantity", quantity);
      if (remarks) formData.set("remarks", remarks);

      const result: EmballageFormState = await createEmballageCollectionAction(
        { error: null },
        formData,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(dict.collectionLogged);
      setQuantity("");
      setRemarks("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="centerId">{dict.centerLabel}</Label>
        <Select
          items={centers.map((c) => ({ value: c.id, label: c.label }))}
          value={centerId}
          onValueChange={(value) => setCenterId(value ?? centers[0]?.id ?? "")}
          disabled={isPending}
        >
          <SelectTrigger id="centerId" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {centers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="productId">{dict.productLabel}</Label>
        <Select
          items={products.map((p) => ({ value: p.id, label: p.label }))}
          value={productId}
          onValueChange={(value) => setProductId(value ?? products[0]?.id ?? "")}
          disabled={isPending}
        >
          <SelectTrigger id="productId" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="visitDate">{dict.visitDateLabel}</Label>
          <Input
            id="visitDate"
            type="date"
            disabled={isPending}
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="quantity">{dict.quantityLabel}</Label>
          <Input
            id="quantity"
            type="number"
            min="0.01"
            step="0.01"
            disabled={isPending}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="remarks">{dict.remarksLabel}</Label>
        <Textarea
          id="remarks"
          disabled={isPending}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={isPending || !centerId || !productId}>
        {isPending ? dict.saving : dict.save}
      </Button>
    </form>
  );
}
