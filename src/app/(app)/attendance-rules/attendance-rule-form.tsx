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
import type { Dictionary } from "@/lib/i18n/dictionary";

import { type AttendanceRuleFormState, createAttendanceRuleAction } from "./actions";

type Option = { id: string; label: string };
type Scope = "territory" | "team" | "individual";

type AttendanceRuleFormProps = {
  territories: Option[];
  people: Option[];
  currentUserName: string;
  dict: Dictionary["attendanceRuleForm"];
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function AttendanceRuleForm({
  territories,
  people,
  currentUserName,
  dict,
}: AttendanceRuleFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [scope, setScope] = useState<Scope>("territory");
  const [territoryId, setTerritoryId] = useState(territories[0]?.id ?? "");
  const [targetUserId, setTargetUserId] = useState(people[0]?.id ?? "");
  const [expectedStart, setExpectedStart] = useState("09:00");
  const [lateGraceMinutes, setLateGraceMinutes] = useState(15);
  const [minimumWorkedMinutes, setMinimumWorkedMinutes] = useState(240);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("scope", scope);
      formData.set("expectedStartMinutes", String(timeToMinutes(expectedStart)));
      formData.set("lateGraceMinutes", String(lateGraceMinutes));
      formData.set("minimumWorkedMinutes", String(minimumWorkedMinutes));
      if (scope === "territory") formData.set("territoryId", territoryId);
      if (scope === "individual") formData.set("targetUserId", targetUserId);

      const result: AttendanceRuleFormState = await createAttendanceRuleAction(
        { error: null },
        formData,
      );

      if (result.sessionExpired) {
        router.push("/login?callbackUrl=/attendance-rules");
        return;
      }

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success(dict.created);
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="scope">{dict.scopeLabel}</Label>
        <Select
          items={[
            { value: "territory", label: dict.scopeTerritory },
            { value: "team", label: dict.scopeTeam },
            { value: "individual", label: dict.scopeIndividual },
          ]}
          value={scope}
          onValueChange={(value) => setScope(value as Scope)}
          disabled={isPending}
        >
          <SelectTrigger id="scope" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="territory">{dict.scopeTerritory}</SelectItem>
            <SelectItem value="team">{dict.scopeTeam}</SelectItem>
            <SelectItem value="individual">{dict.scopeIndividual}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {scope === "territory" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="territoryId">{dict.territoryLabel}</Label>
          <Select
            items={territories.map((t) => ({ value: t.id, label: t.label }))}
            value={territoryId}
            onValueChange={(value) => setTerritoryId(value ?? "")}
            disabled={isPending}
          >
            <SelectTrigger id="territoryId" className="w-full">
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
        </div>
      ) : null}

      {scope === "team" ? (
        <div className="flex flex-col gap-2">
          <Label>{dict.teamOwnerLabel}</Label>
          <p className="text-sm text-muted-foreground">{currentUserName}</p>
        </div>
      ) : null}

      {scope === "individual" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="targetUserId">{dict.individualLabel}</Label>
          <Select
            items={people.map((p) => ({ value: p.id, label: p.label }))}
            value={targetUserId}
            onValueChange={(value) => setTargetUserId(value ?? "")}
            disabled={isPending}
          >
            <SelectTrigger id="targetUserId" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="expectedStart">{dict.expectedStartLabel}</Label>
        <Input
          id="expectedStart"
          type="time"
          disabled={isPending}
          value={expectedStart}
          onChange={(e) => setExpectedStart(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="lateGrace">{dict.lateGraceLabel}</Label>
        <Input
          id="lateGrace"
          type="number"
          min={0}
          max={240}
          disabled={isPending}
          value={lateGraceMinutes}
          onChange={(e) => setLateGraceMinutes(Number(e.target.value))}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="minimumWorked">{dict.minimumWorkedLabel}</Label>
        <Input
          id="minimumWorked"
          type="number"
          min={0}
          max={1440}
          disabled={isPending}
          value={minimumWorkedMinutes}
          onChange={(e) => setMinimumWorkedMinutes(Number(e.target.value))}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? dict.saving : dict.save}
      </Button>
    </form>
  );
}
