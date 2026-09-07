"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { deactivateUserAction } from "./actions";

export function DeactivateButton({ userId, userName }: { userId: string; userName: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    if (!window.confirm(`Deactivate ${userName}? They will no longer be able to sign in.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deactivateUserAction(userId);

      if (result.sessionExpired) {
        router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
        return;
      }

      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="destructive" size="sm" disabled={isPending} onClick={onClick}>
        {isPending ? "Deactivating..." : "Deactivate"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
