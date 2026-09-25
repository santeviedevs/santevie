"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionary";

import {
  CascadingTerritoryFields,
  type CommuneOption,
  type QuartierOption,
  type TerritoryOption,
  type TerritoryValue,
  type VilleOption,
} from "../cascading-territory-fields";
import {
  type AssignmentFormState,
  assignTerritoryAction,
  removeTerritoryAssignmentAction,
} from "./actions";

type AssignmentSummary = {
  id: string;
  level: "province" | "ville" | "commune" | "quartier";
  name: string;
};

const EMPTY_VALUE: TerritoryValue = {
  provinceId: null,
  villeId: null,
  communeId: null,
  quartierId: null,
};

export function AssignmentManager({
  userId,
  assignments,
  territoryData,
  dict,
  territoryDict,
}: {
  userId: string;
  assignments: AssignmentSummary[];
  territoryData: {
    provinces: TerritoryOption[];
    villes: VilleOption[];
    communes: CommuneOption[];
    quartiers: QuartierOption[];
  };
  dict: Dictionary["territoryAssignmentPage"];
  territoryDict: Dictionary["territory"];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [pickValue, setPickValue] = useState<TerritoryValue>(EMPTY_VALUE);
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("userId", userId);
      if (pickValue.provinceId) formData.set("provinceId", pickValue.provinceId);
      if (pickValue.villeId) formData.set("villeId", pickValue.villeId);
      if (pickValue.communeId) formData.set("communeId", pickValue.communeId);
      if (pickValue.quartierId) formData.set("quartierId", pickValue.quartierId);

      const result: AssignmentFormState = await assignTerritoryAction({ error: null }, formData);

      if (result.sessionExpired) {
        router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}?userId=${userId}`);
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }

      setPickValue(EMPTY_VALUE);
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
        <CascadingTerritoryFields
          levels={["province", "ville", "commune", "quartier"]}
          value={pickValue}
          onChange={(patch) => setPickValue((current) => ({ ...current, ...patch }))}
          data={territoryData}
          required={false}
          layout="row"
          labels={{
            province: territoryDict.province,
            ville: territoryDict.ville,
            commune: territoryDict.commune,
            quartier: territoryDict.quartier,
          }}
          placeholders={{
            province: territoryDict.selectProvince,
            ville: territoryDict.selectVille,
            commune: territoryDict.selectCommune,
            quartier: territoryDict.selectQuartier,
          }}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={
              isPending ||
              !(
                pickValue.provinceId ||
                pickValue.villeId ||
                pickValue.communeId ||
                pickValue.quartierId
              )
            }
          >
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
                  <Badge variant="secondary">{territoryDict[assignment.level]}</Badge>
                  <span className="text-sm">{assignment.name}</span>
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
