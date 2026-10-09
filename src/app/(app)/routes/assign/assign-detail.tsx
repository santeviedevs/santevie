"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { assignRouteAction, cancelRouteAssignmentAction, type RouteFormState } from "../actions";

type RouteItem = {
  id: string;
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "MISSED";
  center: { name: string; code: string };
};
type AssignableUser = { id: string; label: string };

const STATUS_VARIANT = {
  PENDING: "secondary",
  COMPLETED: "default",
  CANCELLED: "outline",
  MISSED: "destructive",
} as const;

// The Assignment screen's one write surface — assign/reassign a route
// (target + date) or cancel its assignment (bulk-cancel every still-
// PENDING item). Never touches content; that's Plan Routes' job.
export function AssignDetail({
  routeId,
  visitorName,
  date,
  items,
  users,
  dict,
}: {
  routeId: string;
  visitorName: string | null;
  date: string | null;
  items: RouteItem[];
  users: AssignableUser[];
  dict: Dictionary["routesPage"];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [targetUserId, setTargetUserId] = useState(users[0]?.id ?? "");
  const [formDate, setFormDate] = useState(date ? date.slice(0, 10) : "");

  const hasCompleted = items.some((item) => item.status === "COMPLETED");
  const hasPending = items.some((item) => item.status === "PENDING" || item.status === "MISSED");
  const reassignBlocked = hasCompleted && visitorName !== null;

  function assign() {
    if (!targetUserId || !formDate) return;
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("routeId", routeId);
      formData.set("targetUserId", targetUserId);
      formData.set("date", formDate);
      const result: RouteFormState = await assignRouteAction({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(visitorName ? dict.routeReassigned : dict.routeAssigned);
      router.push("/routes/assign");
    });
  }

  function cancelAssignment() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("routeId", routeId);
      const result: RouteFormState = await cancelRouteAssignmentAction({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(dict.assignmentCancelled);
      router.push("/routes/assign");
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border p-4">
      {items.length > 0 ? (
        <ol className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
            >
              <span>
                {item.center.name} ({item.center.code})
              </span>
              <Badge variant={STATUS_VARIANT[item.status]}>{item.status}</Badge>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">{dict.noCentersYet}</p>
      )}

      {reassignBlocked ? (
        <p className="text-sm text-muted-foreground">{dict.hasCompletedHint}</p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{dict.assignToLabel}</span>
            <Select
              items={users.map((u) => ({ value: u.id, label: u.label }))}
              value={targetUserId}
              onValueChange={(value) => setTargetUserId(value ?? "")}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{dict.dateLabel}</span>
            <Input
              type="date"
              value={formDate}
              disabled={isPending}
              onChange={(e) => setFormDate(e.target.value)}
              className="w-40"
            />
          </div>
          <Button type="button" disabled={isPending || !targetUserId || !formDate} onClick={assign}>
            {visitorName ? dict.reassignAction : dict.assignAction}
          </Button>
        </div>
      )}

      {visitorName && hasPending ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={isPending}
          onClick={cancelAssignment}
        >
          {dict.cancelAssignment}
        </Button>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
