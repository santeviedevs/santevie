"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { decideLeaveAction, type LeaveDecisionFormState } from "./actions";

type LeaveDecisionActionsProps = {
  leaveId: string;
  dict: Dictionary["leavesPage"];
};

// The real authorization check (is this specific requester within the
// current user's reporting-hierarchy scope) runs server-side in
// decideLeave — this component only decides whether to *render* the
// buttons, per src/server/scope.ts's isWithinScope check on the page. A
// forged request against decideLeaveAction for someone out of scope is
// still rejected server-side regardless of what this UI shows.
export function LeaveDecisionActions({ leaveId, dict }: LeaveDecisionActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [remark, setRemark] = useState("");
  const [error, setError] = useState<string | null>(null);

  const decide = (decision: "APPROVED" | "REJECTED") => {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("leaveId", leaveId);
      formData.set("decision", decision);
      if (remark) formData.set("remark", remark);

      const result: LeaveDecisionFormState = await decideLeaveAction({ error: null }, formData);

      if (result.sessionExpired) {
        router.push("/login?callbackUrl=/leaves/team");
        return;
      }

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success(dict.leaveDecided);
      setApproveOpen(false);
      setRejectOpen(false);
      setRemark("");
      router.refresh();
    });
  };

  return (
    <div className="flex gap-2">
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogTrigger render={<Button size="sm" />}>{dict.approve}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dict.approveConfirmTitle}</DialogTitle>
          </DialogHeader>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={isPending} />}>
              {dict.cancel}
            </DialogClose>
            <Button disabled={isPending} onClick={() => decide("APPROVED")}>
              {dict.approveConfirmButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogTrigger render={<Button size="sm" variant="destructive" />}>
          {dict.reject}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dict.rejectConfirmTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reject-remark">{dict.rejectRemarkLabel}</Label>
            <Textarea
              id="reject-remark"
              value={remark}
              onChange={(event) => setRemark(event.target.value)}
              disabled={isPending}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={isPending} />}>
              {dict.cancel}
            </DialogClose>
            <Button variant="destructive" disabled={isPending} onClick={() => decide("REJECTED")}>
              {dict.rejectConfirmButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
