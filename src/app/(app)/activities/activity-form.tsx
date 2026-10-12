"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { type ActivityFormState, createActivityAction, updateActivityAction } from "./actions";

type Option = { id: string; label: string };
type Target = "center" | "territory";

export type EditableActivity = {
  id: string;
  name: string;
  type: "CAMPAIGN" | "EVENT" | "OTHER";
  centerId: string | null;
  territoryId: string | null;
  notes: string | null;
};

// Creation and editing share one form: creating is a manager action
// (activities:assign) that starts the activity unassigned — the Assignment
// screen is where it's given to one or more people; editing goes through
// the same permission and authorization boundary the service enforces again.
export function ActivityForm({
  activity,
  centers,
  territories,
  dict,
}: {
  activity?: EditableActivity;
  centers: Option[];
  territories: Option[];
  dict: Dictionary["activitiesPage"];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(activity?.name ?? "");
  const [type, setType] = useState<"CAMPAIGN" | "EVENT" | "OTHER">(activity?.type ?? "CAMPAIGN");
  const [target, setTarget] = useState<Target>(activity?.territoryId ? "territory" : "center");
  const [centerId, setCenterId] = useState(activity?.centerId ?? centers[0]?.id ?? "");
  const [territoryId, setTerritoryId] = useState(activity?.territoryId ?? territories[0]?.id ?? "");
  const [notes, setNotes] = useState(activity?.notes ?? "");

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      if (activity) formData.set("id", activity.id);
      formData.set("name", name);
      formData.set("type", type);
      formData.set("notes", notes);
      if (target === "center") formData.set("centerId", centerId);
      if (target === "territory") formData.set("territoryId", territoryId);

      const result: ActivityFormState = activity
        ? await updateActivityAction({ error: null }, formData)
        : await createActivityAction({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(activity ? dict.activityUpdated : dict.activityCreated);
      router.push(activity ? `/activities/${activity.id}` : "/activities");
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{dict.nameLabel}</Label>
        <Input
          id="name"
          disabled={isPending}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="type">{dict.typeLabel}</Label>
        <Select
          items={[
            { value: "CAMPAIGN", label: dict.typeCampaign },
            { value: "EVENT", label: dict.typeEvent },
            { value: "OTHER", label: dict.typeOther },
          ]}
          value={type}
          onValueChange={(value) => setType((value ?? "CAMPAIGN") as typeof type)}
          disabled={isPending}
        >
          <SelectTrigger id="type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CAMPAIGN">{dict.typeCampaign}</SelectItem>
            <SelectItem value="EVENT">{dict.typeEvent}</SelectItem>
            <SelectItem value="OTHER">{dict.typeOther}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="target">{dict.targetLabel}</Label>
        <Select
          items={[
            { value: "center", label: dict.targetCenter },
            { value: "territory", label: dict.targetTerritory },
          ]}
          value={target}
          onValueChange={(value) => setTarget((value ?? "center") as Target)}
          disabled={isPending}
        >
          <SelectTrigger id="target" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="center">{dict.targetCenter}</SelectItem>
            <SelectItem value="territory">{dict.targetTerritory}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {target === "center" ? (
        <Select
          items={centers.map((c) => ({ value: c.id, label: c.label }))}
          value={centerId}
          onValueChange={(value) => setCenterId(value ?? "")}
          disabled={isPending}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {centers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Select
          items={territories.map((t) => ({ value: t.id, label: t.label }))}
          value={territoryId}
          onValueChange={(value) => setTerritoryId(value ?? "")}
          disabled={isPending}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {territories.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">{dict.notesLabel}</Label>
        <Textarea
          id="notes"
          disabled={isPending}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? dict.saving : dict.save}
      </Button>
    </form>
  );
}
