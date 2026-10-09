"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { setPersonStatusAction } from "./actions";

// Activate / Deactivate row action. Deactivation only flips the status —
// the Person and its Center links are kept.
export function PersonStatusButton({
  personId,
  status,
  activateLabel,
  deactivateLabel,
  changedLabel,
}: {
  personId: string;
  status: "ACTIVE" | "INACTIVE";
  activateLabel: string;
  deactivateLabel: string;
  changedLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const next = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await setPersonStatusAction(personId, next);
          if (result.sessionExpired) {
            router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
            return;
          }
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(changedLabel);
          router.refresh();
        })
      }
    >
      {status === "ACTIVE" ? deactivateLabel : activateLabel}
    </Button>
  );
}
