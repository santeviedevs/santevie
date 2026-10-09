"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTime, formatTimestampDate } from "@/lib/format-date";
import { type GeolocationFix, useGeolocation } from "@/lib/hooks/use-geolocation";
import type { Dictionary } from "@/lib/i18n/dictionary";
import {
  MAX_ACCEPTABLE_ACCURACY_METERS,
  MAX_REJECTABLE_ACCURACY_METERS,
} from "@/lib/schemas/attendance";
import type { TodayAttendanceState } from "@/server/services/attendance-service";

import { type AttendanceActionState, checkInAction, checkOutAction } from "./actions";

type CheckInOutCardProps = {
  todayState: TodayAttendanceState;
  requiresLocation: boolean;
  dict: Dictionary["checkInOutPage"];
};

type AttendanceAction = typeof checkInAction;

export function CheckInOutCard({ todayState, requiresLocation, dict }: CheckInOutCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { state: geo, request, reset } = useGeolocation();
  const [formState, setFormState] = useState<AttendanceActionState>({ error: null });

  const isCheckedIn = todayState.status === "checked-in";
  const action = isCheckedIn ? checkOutAction : checkInAction;
  const actionButton = isCheckedIn ? dict.checkOutButton : dict.checkInButton;
  const guidance = isCheckedIn ? dict.checkOutPermissionGuidance : dict.permissionGuidance;
  const pendingLabel = isCheckedIn ? dict.checkingOut : dict.checkingIn;
  const successToast = isCheckedIn ? dict.checkedOutToast : dict.checkedInToast;

  const submit = (fix?: GeolocationFix) => {
    startTransition(async () => {
      const formData = new FormData();
      if (fix) {
        formData.set("lat", String(fix.lat));
        formData.set("lng", String(fix.lng));
        formData.set("accuracy", String(fix.accuracy));
        formData.set("deviceTimestamp", fix.deviceTimestamp);
      }

      const result: AttendanceActionState = await (action as AttendanceAction)(
        { error: null },
        formData,
      );

      if (result.sessionExpired) {
        router.push("/login?callbackUrl=/attendance/check-in-out");
        return;
      }

      if (result.error) {
        setFormState(result);
        return;
      }

      setFormState({ error: null });
      reset();
      toast.success(successToast);
      // The server action already revalidated the path — refresh so the
      // Server Component page re-fetches getTodayAttendanceState and
      // listMySessions, updating the card and history table together from
      // the same authoritative read, rather than guessing the new state
      // client-side.
      router.refresh();
    });
  };

  function statusLine() {
    if (isCheckedIn && todayState.latestSession) {
      return `${dict.checkedInStatusPrefix} ${formatTime(todayState.latestSession.checkInAt)}`;
    }
    if (!isCheckedIn && todayState.latestSession?.checkOutAt) {
      return `${dict.lastCheckedOutStatusPrefix} ${formatTime(todayState.latestSession.checkOutAt)}`;
    }
    return dict.readyStatus;
  }

  function renderLocationFlow() {
    if (!requiresLocation) {
      return (
        <Button size="lg" className="w-full" onClick={() => submit()} disabled={isPending}>
          {isPending ? (
            <>
              <Loader2Icon className="animate-spin" />
              {pendingLabel}
            </>
          ) : (
            actionButton
          )}
        </Button>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        {geo.status === "idle" ? <p className="text-sm text-muted-foreground">{guidance}</p> : null}

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
            <Button size="lg" className="w-full" onClick={request} disabled={isPending}>
              {geo.status === "idle" ? actionButton : dict.tryAgain}
            </Button>
          </>
        ) : null}

        {geo.status === "requesting" ? (
          <Button size="lg" className="w-full" disabled>
            <Loader2Icon className="animate-spin" />
            {dict.requesting}
          </Button>
        ) : null}

        {geo.status === "success" && geo.fix.accuracy > MAX_REJECTABLE_ACCURACY_METERS ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-destructive">{dict.lowAccuracyTitle}</p>
            <p className="text-sm text-muted-foreground">{dict.lowAccuracyBody}</p>
            <Button size="lg" className="w-full" onClick={request} disabled={isPending}>
              {dict.tryAgain}
            </Button>
          </div>
        ) : null}

        {geo.status === "success" &&
        geo.fix.accuracy > MAX_ACCEPTABLE_ACCURACY_METERS &&
        geo.fix.accuracy <= MAX_REJECTABLE_ACCURACY_METERS ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
              {dict.borderlineAccuracyTitle}
            </p>
            <p className="text-sm text-muted-foreground">{dict.borderlineAccuracyBody}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={request} disabled={isPending}>
                {dict.tryAgain}
              </Button>
              <Button className="flex-1" onClick={() => submit(geo.fix)} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2Icon className="animate-spin" />
                    {pendingLabel}
                  </>
                ) : (
                  dict.continueAnyway
                )}
              </Button>
            </div>
          </div>
        ) : null}

        {geo.status === "success" && geo.fix.accuracy <= MAX_ACCEPTABLE_ACCURACY_METERS ? (
          <Button size="lg" className="w-full" onClick={() => submit(geo.fix)} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2Icon className="animate-spin" />
                {pendingLabel}
              </>
            ) : (
              actionButton
            )}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">
          {formatTimestampDate(new Date())}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-base font-medium transition-opacity">{statusLine()}</p>

        {renderLocationFlow()}

        {formState.error ? (
          <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">{formState.error}</p>
            {requiresLocation ? (
              <Button variant="outline" size="sm" onClick={reset} className="self-start">
                {dict.tryAgain}
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
