"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { TerritoryPicker, type TerritoryPickerOption } from "../territory-picker";
import {
  type AssignmentFormState,
  assignTerritoryAction,
  removeTerritoryAssignmentAction,
} from "./actions";

type AssignmentSummary = { id: string; code: string; label: string };

export function AssignmentManager({
  userId,
  assignments,
  territoryOptions,
  dict,
  territoryPickerDict,
}: {
  userId: string;
  assignments: AssignmentSummary[];
  territoryOptions: TerritoryPickerOption[];
  dict: Dictionary["territoryAssignmentPage"];
  territoryPickerDict: Dictionary["territory"];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [territoryId, setTerritoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    if (!territoryId) return;
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("userId", userId);
      formData.set("territoryId", territoryId);

      const result: AssignmentFormState = await assignTerritoryAction({ error: null }, formData);

      if (result.sessionExpired) {
        router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}?userId=${userId}`);
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }

      setTerritoryId(null);
      toast.success(dict.assigned);
      router.refresh();
    });
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", id);
      const result: AssignmentFormState = await removeTerritoryAssignmentAction(
        { error: null },
        formData,
      );

      if (result.sessionExpired) {
        router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}?userId=${userId}`);
        return;
      }
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(dict.removed);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-md border border-border p-4">
        <h2 className="text-sm font-semibold">{dict.addHeading}</h2>
        <TerritoryPicker
          id="territoryId"
          label={territoryPickerDict.province}
          placeholder={territoryPickerDict.selectProvince}
          clearLabel={territoryPickerDict.anyProvince}
          noResultsLabel={territoryPickerDict.noMatches}
          options={territoryOptions}
          value={territoryId}
          onChange={setTerritoryId}
          disabled={isPending}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div>
          <Button type="button" onClick={handleAdd} disabled={isPending || !territoryId}>
            {isPending ? dict.saving : dict.assign}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{dict.currentHeading}</h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{dict.noAssignments}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {assignments.map((assignment) => (
              <li
                key={assignment.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{assignment.code}</Badge>
                  <span className="text-sm">{assignment.label}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleRemove(assignment.id)}
                >
                  {dict.remove}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
