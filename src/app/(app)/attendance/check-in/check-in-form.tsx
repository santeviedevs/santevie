"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format-date";
import { useGeolocation } from "@/lib/hooks/use-geolocation";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { MAX_ACCEPTABLE_ACCURACY_METERS } from "@/lib/schemas/attendance";

import { checkInAction, type CheckInFormState } from "./actions";

type CheckInFormProps = {
  requiresLocation: boolean;
  dict: Dictionary["checkInPage"];
};

export function CheckInForm({ requiresLocation, dict }: CheckInFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { state: geo, request, reset } = useGeolocation();
  const [formState, setFormState] = useState<CheckInFormState>({ error: null });

  const submit = (fix?: {
    lat: number;
    lng: number;
    accuracy: number;
    deviceTimestamp: string;
  }) => {
    startTransition(async () => {
      const formData = new FormData();
      if (fix) {
        formData.set("lat", String(fix.lat));
        formData.set("lng", String(fix.lng));
        formData.set("accuracy", String(fix.accuracy));
        formData.set("deviceTimestamp", fix.deviceTimestamp);
      }

      const result = await checkInAction({ error: null }, formData);

      if (result.sessionExpired) {
        router.push("/login?callbackUrl=/attendance/check-in");
        return;
      }

      setFormState(result);
    });
  };

  // Explicit, unmistakable confirmation — a delegate is often about to put
  // the phone away and walk into a visit, so a silent state change isn't
  // enough.
  if (formState.result) {
    return (
      <div className="flex max-w-md flex-col gap-4 rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold">{dict.successTitle}</h2>
        <p className="text-sm text-muted-foreground">
          {dict.successBodyPrefix} {formatDateTime(formState.result.checkInAt)}.
        </p>
        <Button onClick={() => router.push("/")}>{dict.backToHome}</Button>
      </div>
    );
  }

  if (!requiresLocation) {
    return (
      <div className="flex max-w-md flex-col gap-4">
        <Button onClick={() => submit()} disabled={isPending}>
          {isPending ? dict.requesting : dict.checkInButton}
        </Button>
        {formState.error ? <p className="text-sm text-destructive">{formState.error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <p className="text-sm text-muted-foreground">{dict.permissionGuidance}</p>

      {geo.status === "idle" ||
      geo.status === "denied" ||
      geo.status === "unavailable" ||
      geo.status === "timeout" ? (
        <>
          {geo.status === "denied" ? (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-destructive">{dict.deniedTitle}</p>
              <p className="text-sm text-muted-foreground">{dict.deniedBody}</p>
            </div>
          ) : null}
          {geo.status === "unavailable" ? (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-destructive">{dict.unavailableTitle}</p>
              <p className="text-sm text-muted-foreground">{dict.unavailableBody}</p>
            </div>
          ) : null}
          {geo.status === "timeout" ? (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-destructive">{dict.timeoutTitle}</p>
              <p className="text-sm text-muted-foreground">{dict.timeoutBody}</p>
            </div>
          ) : null}
          <Button onClick={request} disabled={isPending}>
            {geo.status === "idle" ? dict.checkInButton : dict.tryAgain}
          </Button>
        </>
      ) : null}

      {geo.status === "requesting" ? <Button disabled>{dict.requesting}</Button> : null}

      {geo.status === "success" && geo.fix.accuracy > MAX_ACCEPTABLE_ACCURACY_METERS ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-destructive">{dict.lowAccuracyTitle}</p>
          <p className="text-sm text-muted-foreground">{dict.lowAccuracyBody}</p>
          <Button onClick={request} disabled={isPending}>
            {dict.tryAgain}
          </Button>
        </div>
      ) : null}

      {geo.status === "success" && geo.fix.accuracy <= MAX_ACCEPTABLE_ACCURACY_METERS ? (
        <Button onClick={() => submit(geo.fix)} disabled={isPending}>
          {isPending ? dict.requesting : dict.checkInButton}
        </Button>
      ) : null}

      {formState.error ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-destructive">{formState.error}</p>
          <Button variant="outline" onClick={reset}>
            {dict.tryAgain}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
