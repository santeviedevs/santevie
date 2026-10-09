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

import { type ActivityFormState, createActivityAction } from "./actions";

type Option = { id: string; label: string };
type Target = "client" | "territory";

export function ActivityForm({
  clients,
  territories,
  dict,
}: {
  clients: Option[];
  territories: Option[];
  dict: Dictionary["activitiesPage"];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<"CAMPAIGN" | "EVENT" | "OTHER">("CAMPAIGN");
  const [target, setTarget] = useState<Target>("client");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [territoryId, setTerritoryId] = useState(territories[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("type", type);
      formData.set("date", date);
      formData.set("notes", notes);
      if (target === "client") formData.set("clientId", clientId);
      if (target === "territory") formData.set("territoryId", territoryId);

      const result: ActivityFormState = await createActivityAction({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(dict.activityCreated);
      router.push("/activities");
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-3">
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
        <Label htmlFor="date">{dict.dateLabel}</Label>
        <Input
          id="date"
          type="date"
          disabled={isPending}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="target">{dict.targetLabel}</Label>
        <Select
          items={[
            { value: "client", label: dict.targetClient },
            { value: "territory", label: dict.targetTerritory },
          ]}
          value={target}
          onValueChange={(value) => setTarget((value ?? "client") as Target)}
          disabled={isPending}
        >
          <SelectTrigger id="target" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="client">{dict.targetClient}</SelectItem>
            <SelectItem value="territory">{dict.targetTerritory}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {target === "client" ? (
        <Select
          items={clients.map((c) => ({ value: c.id, label: c.label }))}
          value={clientId}
          onValueChange={(value) => setClientId(value ?? "")}
          disabled={isPending}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
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
