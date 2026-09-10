"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { activateTerritoryAction, deactivateTerritoryAction } from "./actions";

type StatusButtonProps = {
  territoryId: string;
  territoryName: string;
  status: "ACTIVE" | "INACTIVE";
};

export function StatusButton({ territoryId, territoryName, status }: StatusButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isActive = status === "ACTIVE";

  const onClick = () => {
    if (
      isActive &&
      !window.confirm(`Deactivate ${territoryName}? It will no longer be selectable for new work.`)
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const action = isActive ? deactivateTerritoryAction : activateTerritoryAction;
      const result = await action(territoryId);

      if (result.sessionExpired) {
        router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
        return;
      }

      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(`${territoryName} ${isActive ? "deactivated" : "activated"}`);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant={isActive ? "destructive" : "outline"}
        size="sm"
        disabled={isPending}
        onClick={onClick}
      >
        {isPending ? "Saving..." : isActive ? "Deactivate" : "Activate"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
