"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { updateWorkingDaysAction, type WorkingDaysFormState } from "./actions";

type WorkingDaysFormProps = {
  territoryId: string;
  workingDays: { dayOfWeek: number; isWorking: boolean }[];
  dict: Dictionary["workingDaysPage"];
};

export function WorkingDaysForm({ territoryId, workingDays, dict }: WorkingDaysFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Defensive default (all working) for any day missing a row — should be
  // unreachable once territory-service.ts's auto-seed hook is in place, but
  // this keeps the form usable even against a territory created before it.
  const [days, setDays] = useState<boolean[]>(() =>
    Array.from({ length: 7 }, (_, dayOfWeek) => {
      const row = workingDays.find((day) => day.dayOfWeek === dayOfWeek);
      return row ? row.isWorking : true;
    }),
  );

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("territoryId", territoryId);
      days.forEach((isWorking, dayOfWeek) => {
        if (isWorking) formData.set(`day-${dayOfWeek}`, "on");
      });

      const result: WorkingDaysFormState = await updateWorkingDaysAction({ error: null }, formData);

      if (result.sessionExpired) {
        router.push("/login?callbackUrl=/admin/territories");
        return;
      }

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success(dict.updated);
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex max-w-sm flex-col gap-3">
      {dict.dayLabels.map((label, dayOfWeek) => (
        <div
          key={dayOfWeek}
          className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
        >
          <Label htmlFor={`day-${dayOfWeek}`}>{label}</Label>
          <Switch
            id={`day-${dayOfWeek}`}
            disabled={isPending}
            checked={days[dayOfWeek]}
            onCheckedChange={(checked) =>
              setDays((current) => current.map((v, i) => (i === dayOfWeek ? checked : v)))
            }
          />
        </div>
      ))}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? dict.saving : dict.save}
      </Button>
    </form>
  );
}
