"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { type ExchangeRateFormState, setExchangeRateAction } from "./actions";

type ExchangeRateFormProps = {
  currentRate: number | null;
  dict: Dictionary["exchangeRatePage"];
};

export function ExchangeRateForm({ currentRate, dict }: ExchangeRateFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [value, setValue] = useState(currentRate !== null ? String(currentRate) : "");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("rate", value);

      const result: ExchangeRateFormState = await setExchangeRateAction({ error: null }, formData);

      if (result.sessionExpired) {
        router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
        return;
      }

      if (result.error) {
        setFormError(result.error);
        return;
      }

      toast.success(dict.rateUpdated);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-sm flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="rate">{dict.rateLabel}</Label>
        <Input
          id="rate"
          type="number"
          step="0.0001"
          min="0"
          disabled={isPending}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">{dict.rateHint}</p>
      </div>

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? dict.saving : dict.save}
      </Button>
    </form>
  );
}
