"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { createTerritoryAction, type TerritoryFormState, updateTerritoryAction } from "./actions";
import type {
  CommuneOption,
  QuartierOption,
  TerritoryOption,
  VilleOption,
} from "./cascading-territory-fields";
import { TerritoryComboFields, type TerritoryComboValue } from "./territory-combo-fields";

type Status = "ACTIVE" | "INACTIVE";

type TerritoryFormProps = {
  mode: "create" | "edit";
  options: {
    provinces: TerritoryOption[];
    villes: VilleOption[];
    communes: CommuneOption[];
    quartiers: QuartierOption[];
  };
  // Edit mode only — the Territory's current path and status.
  defaultValues?: {
    id: string;
    code: string;
    provinceId: string;
    villeId?: string;
    communeId?: string;
    quartierId?: string;
    status: Status;
  };
  dict: Dictionary["territoriesPage"];
  hierarchyDict: Dictionary["territory"];
};

const EMPTY: TerritoryComboValue = {
  province: { mode: "existing", id: "" },
  ville: { mode: "existing", id: "" },
  commune: { mode: "existing", id: "" },
  quartier: { mode: "existing", id: "" },
};

export function TerritoryForm({
  mode,
  options,
  defaultValues,
  dict,
  hierarchyDict,
}: TerritoryFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const draftKey = `territory-form-draft:${pathname}`;
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const [path, setPath] = useState<TerritoryComboValue>(
    defaultValues
      ? {
          province: { mode: "existing", id: defaultValues.provinceId },
          ville: { mode: "existing", id: defaultValues.villeId ?? "" },
          commune: { mode: "existing", id: defaultValues.communeId ?? "" },
          quartier: { mode: "existing", id: defaultValues.quartierId ?? "" },
        }
      : EMPTY,
  );
  const [status, setStatus] = useState<Status>(defaultValues?.status ?? "ACTIVE");

  // If a session-expiry redirect left a draft behind for this exact page,
  // restore it once and discard it — it's meant to survive one re-login,
  // not linger and reappear on a later, unrelated visit to this form.
  useEffect(() => {
    const saved = sessionStorage.getItem(draftKey);
    if (saved) {
      const draft = JSON.parse(saved) as { path: TerritoryComboValue };
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPath(draft.path);
      sessionStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    startTransition(async () => {
      const formData = new FormData();
      if (mode === "edit" && defaultValues) {
        formData.set("id", defaultValues.id);
        formData.set("status", status);
      }

      for (const level of ["province", "ville", "commune", "quartier"] as const) {
        const value = path[level];
        if (level !== "province" && value.mode === "existing" && !value.id) continue;
        formData.set(`${level}Mode`, value.mode);
        if (value.mode === "existing") formData.set(`${level}Id`, value.id);
        else formData.set(`${level}Name`, value.name);
      }

      const action = mode === "create" ? createTerritoryAction : updateTerritoryAction;
      const result: TerritoryFormState = await action({ error: null }, formData);

      if (result.sessionExpired) {
        sessionStorage.setItem(draftKey, JSON.stringify({ path }));
        router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
        return;
      }

      if (result.error) {
        setFormError(result.error);
        return;
      }

      toast.success(mode === "create" ? dict.created : dict.updated);
      router.push("/admin/territories");
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4" noValidate>
      <TerritoryComboFields
        value={path}
        onChange={(patch) => setPath((prev) => ({ ...prev, ...patch }))}
        data={options}
        disabled={isPending}
        labels={{
          province: hierarchyDict.province,
          ville: hierarchyDict.ville,
          commune: hierarchyDict.commune,
          quartier: hierarchyDict.quartier,
        }}
        placeholderTemplate={hierarchyDict.typeOrSelectPlaceholder}
        createOptionTemplate={hierarchyDict.createOption}
        noResultsLabel={hierarchyDict.noMatches}
      />

      {mode === "edit" && defaultValues ? (
        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">{defaultValues.code}</span>
            <span className="text-xs text-muted-foreground">{dict.activate}</span>
          </div>
          <Switch
            id="status"
            aria-label={dict.activate}
            disabled={isPending}
            checked={status !== "INACTIVE"}
            onCheckedChange={(checked) => setStatus(checked ? "ACTIVE" : "INACTIVE")}
          />
        </div>
      ) : null}

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? dict.saving : mode === "create" ? dict.createTerritory : dict.save}
      </Button>
    </form>
  );
}
