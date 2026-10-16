"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { SearchCombobox } from "@/components/search-combobox";
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
import type { Dictionary } from "@/lib/i18n/dictionary";

import { createPrescriptionTargetAction, type PrescriptionTargetFormState } from "./actions";

type Option = { id: string; label: string };
type Assignee = { id: string; name: string; employeeCode: string; roleName: string };
type Dict = Dictionary["prescriptionsPage"];

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

// Manager-facing: sets a new monthly target for one prescriber/product/
// delegate combination. The delegate picker is a server-side search scoped
// to the caller's own team (same /api/.../assignees convention as activity
// assignment); prescriber/product are preloaded in full, same "bounded,
// admin-maintained list" convention as Emballage's centre/product pickers.
export function PrescriptionTargetForm({
  contacts,
  products,
  dict,
}: {
  contacts: Option[];
  products: Option[];
  dict: Dict;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const now = new Date();

  const [contactId, setContactId] = useState(contacts[0]?.id ?? "");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [delegate, setDelegate] = useState<Assignee | null>(null);
  const [monthlyTarget, setMonthlyTarget] = useState("");
  const [periodMonth, setPeriodMonth] = useState(String(now.getMonth() + 1));
  const [periodYear, setPeriodYear] = useState(String(now.getFullYear()));

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!delegate) {
      setError(dict.searchDelegatesPlaceholder);
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("contactId", contactId);
      formData.set("productId", productId);
      formData.set("userId", delegate.id);
      formData.set("monthlyTarget", monthlyTarget);
      formData.set("periodMonth", periodMonth);
      formData.set("periodYear", periodYear);

      const result: PrescriptionTargetFormState = await createPrescriptionTargetAction(
        { error: null },
        formData,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(dict.targetSaved);
      setMonthlyTarget("");
      setDelegate(null);
      setResetKey((key) => key + 1);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="contactId">{dict.contactLabel}</Label>
        <Select
          items={contacts.map((c) => ({ value: c.id, label: c.label }))}
          value={contactId}
          onValueChange={(value) => setContactId(value ?? contacts[0]?.id ?? "")}
          disabled={isPending}
        >
          <SelectTrigger id="contactId" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {contacts.map((c) => (
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

      <div className="flex flex-col gap-2">
        <Label htmlFor="delegate">{dict.delegateLabel}</Label>
        <SearchCombobox<Assignee>
          key={`delegate-${resetKey}`}
          inputId="delegate"
          buildUrl={(q) => `/api/prescriptions/assignees?q=${encodeURIComponent(q)}`}
          extract={(json) => (json as { users: Assignee[] }).users}
          getId={(item) => item.id}
          getLabel={(item) => `${item.name} (${item.employeeCode})`}
          renderItem={(item) => (
            <span className="flex min-w-0 flex-col">
              <span className="font-medium">{item.name}</span>
              <span className="text-xs text-muted-foreground">
                {item.employeeCode} · {item.roleName}
              </span>
            </span>
          )}
          value={delegate}
          onChange={setDelegate}
          placeholder={dict.searchDelegatesPlaceholder}
          emptyLabel={dict.noMatchingDelegates}
          loadingLabel={dict.searching}
          errorLabel={dict.searchFailed}
          disabled={isPending}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="monthlyTarget">{dict.monthlyTargetLabel}</Label>
          <Input
            id="monthlyTarget"
            type="number"
            min="1"
            step="1"
            disabled={isPending}
            value={monthlyTarget}
            onChange={(e) => setMonthlyTarget(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="periodMonth">{dict.periodMonthLabel}</Label>
          <Select
            items={MONTHS.map((m) => ({ value: String(m), label: String(m) }))}
            value={periodMonth}
            onValueChange={(value) => setPeriodMonth(value ?? periodMonth)}
            disabled={isPending}
          >
            <SelectTrigger id="periodMonth" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="periodYear">{dict.periodYearLabel}</Label>
          <Input
            id="periodYear"
            type="number"
            min="2000"
            max="2100"
            step="1"
            disabled={isPending}
            value={periodYear}
            onChange={(e) => setPeriodYear(e.target.value)}
            required
          />
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={isPending || !contactId || !productId}>
        {isPending ? dict.saving : dict.save}
      </Button>
    </form>
  );
}
