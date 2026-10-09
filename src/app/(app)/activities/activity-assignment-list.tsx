"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/format-date";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { type ActivityFormState, assignActivityAction } from "./actions";

type Option = { id: string; label: string };

export type AssignableActivity = {
  id: string;
  type: string;
  date: string;
  status: string;
  center: { name: string; code: string } | null;
  territory: { code: string } | null;
  owner: { id: string; name: string } | null;
};

// Same list+action pattern as Plans > Assignment. Only a PLANNED activity can
// be (re)assigned — the server enforces that too; here a finished or
// cancelled one simply shows no controls.
export function ActivityAssignmentList({
  activities,
  users,
  dict,
}: {
  activities: AssignableActivity[];
  users: Option[];
  dict: Dictionary["activitiesPage"];
}) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">{dict.noActivitiesToAssign}</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {activities.map((activity) => (
        <AssignmentRow key={activity.id} activity={activity} users={users} dict={dict} />
      ))}
    </ul>
  );
}

function AssignmentRow({
  activity,
  users,
  dict,
}: {
  activity: AssignableActivity;
  users: Option[];
  dict: Dictionary["activitiesPage"];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState(activity.owner?.id ?? "");

  const assignable = activity.status === "PLANNED";
  const changed = ownerId !== "" && ownerId !== activity.owner?.id;

  function assign() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", activity.id);
      formData.set("ownerId", ownerId);
      const result: ActivityFormState = await assignActivityAction({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(dict.activityAssigned);
    });
  }

  return (
    <li className="flex flex-col gap-3 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{activity.type}</Badge>
        <span className="text-sm font-medium">
          {formatDate(new Date(activity.date))} —{" "}
          {activity.center
            ? `${activity.center.name} (${activity.center.code})`
            : activity.territory?.code}
        </span>
        <Badge variant="outline">{activity.status}</Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        {activity.owner ? `${dict.assignedToPrefix} ${activity.owner.name}` : dict.unassignedLabel}
      </p>

      {assignable ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{dict.assignToLabel}</span>
            <Select
              items={users.map((u) => ({ value: u.id, label: u.label }))}
              value={ownerId}
              onValueChange={(value) => setOwnerId(value ?? "")}
              disabled={isPending}
            >
              <SelectTrigger className="w-56">
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
          <Button type="button" disabled={isPending || !changed} onClick={assign}>
            {activity.owner ? dict.reassignAction : dict.assignAction}
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </li>
  );
}
