"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { CreatableCombobox, type CreatableOption } from "@/components/creatable-combobox";
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
import { Switch } from "@/components/ui/switch";
import type { Dictionary } from "@/lib/i18n/dictionary";
import {
  type CenterOption,
  type CreatePersonInput,
  createPersonSchema,
  GENDERS,
  type UpdatePersonInput,
  updatePersonSchema,
} from "@/lib/schemas/person";

import { TerritoryPicker, type TerritoryPickerOption } from "../territories/territory-picker";
import { createPersonAction, type PersonFormState, updatePersonAction } from "./actions";
import { CenterAssociationEditor } from "./center-association-editor";
import { createLookupOption } from "./create-lookup-option";

type Lookup = { id: string; code: string; name: string };

type PersonFormProps = {
  mode: "create" | "edit";
  options: {
    personTypes: Lookup[];
    specializations: Lookup[];
    centerRoles: Lookup[];
    territories: TerritoryPickerOption[];
    centers: CenterOption[];
  };
  defaultValues?: Partial<UpdatePersonInput>;
  dict: Dictionary["persons"];
  territoryDict: Dictionary["territory"];
};

const toOptions = (rows: Lookup[]): CreatableOption[] =>
  rows.map((row) => ({ id: row.id, label: row.name }));

export function PersonForm({ mode, options, defaultValues, dict, territoryDict }: PersonFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [personTypes, setPersonTypes] = useState(() => toOptions(options.personTypes));
  const [specializations, setSpecializations] = useState(() => toOptions(options.specializations));

  const schema = mode === "create" ? createPersonSchema : updatePersonSchema;
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<CreatePersonInput | UpdatePersonInput>({
    resolver: zodResolver(schema),
    defaultValues: { centers: [], ...defaultValues },
  });

  const personTypeId = useWatch({ control, name: "personTypeId" });
  const specializationId = useWatch({ control, name: "specializationId" });
  const territoryId = useWatch({ control, name: "territoryId" });
  const gender = useWatch({ control, name: "gender" });
  const centers = useWatch({ control, name: "centers" }) ?? [];
  const status = useWatch({ control, name: "status" });

  const onSubmit = (values: CreatePersonInput | UpdatePersonInput) => {
    setFormError(null);
    startTransition(async () => {
      const formData = new FormData();
      if ("id" in values && values.id) formData.set("id", values.id);
      formData.set("name", values.name);
      formData.set("personTypeId", values.personTypeId);
      if (values.gender) formData.set("gender", values.gender);
      if (values.mobile) formData.set("mobile", values.mobile);
      formData.set("specializationId", values.specializationId);
      formData.set("territoryId", values.territoryId);
      formData.set("centers", JSON.stringify(values.centers));
      if (mode === "edit" && "status" in values && values.status) {
        formData.set("status", values.status);
      }

      const action = mode === "create" ? createPersonAction : updatePersonAction;
      const result: PersonFormState = await action({ error: null }, formData);

      if (result.sessionExpired) {
        router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
        return;
      }
      if (result.error) {
        setFormError(result.error);
        return;
      }

      toast.success(mode === "create" ? dict.personCreated : dict.personUpdated);
      router.push("/admin/persons");
      router.refresh();
    });
  };

  const genderLabels: Record<string, string> = {
    "": dict.genderNone,
    MALE: dict.genderMale,
    FEMALE: dict.genderFemale,
    OTHER: dict.genderOther,
  };
  const genderItems = ["", ...GENDERS].map((value) => ({
    value,
    label: genderLabels[value] ?? value,
  }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-2xl flex-col gap-6" noValidate>
      <section className="flex flex-col gap-4 rounded-md border border-border p-4">
        <h2 className="text-sm font-medium">{dict.basicSection}</h2>
        <p className="text-xs text-muted-foreground">{dict.codeNote}</p>

        <div className="flex flex-col gap-2">
          <Label htmlFor="name">
            {dict.name} <span className="text-destructive">*</span>
          </Label>
          <Input id="name" disabled={isPending} {...register("name")} />
          {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="personTypeId">
            {dict.personType} <span className="text-destructive">*</span>
          </Label>
          <CreatableCombobox
            id="personTypeId"
            placeholder={dict.selectOrAddType}
            options={personTypes}
            value={personTypeId || null}
            onChange={(next) => setValue("personTypeId", next ?? "", { shouldValidate: true })}
            onCreate={async (name) => {
              const created = await createLookupOption("personType", name);
              if (!created) return null;
              setPersonTypes((prev) =>
                prev.some((p) => p.id === created.id) ? prev : [...prev, created],
              );
              return created;
            }}
            addLabel={dict.addNew}
            noMatchesLabel={dict.noMatches}
            disabled={isPending}
          />
          {errors.personTypeId ? (
            <p className="text-sm text-destructive">{errors.personTypeId.message}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="gender">{dict.gender}</Label>
            <Select
              items={genderItems}
              value={gender ?? ""}
              onValueChange={(value) =>
                setValue("gender", value ? (value as (typeof GENDERS)[number]) : null, {
                  shouldDirty: true,
                })
              }
              disabled={isPending}
            >
              <SelectTrigger id="gender" className="w-full">
                <SelectValue placeholder={dict.genderNone} />
              </SelectTrigger>
              <SelectContent>
                {genderItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="mobile">{dict.mobile}</Label>
            <Input
              id="mobile"
              type="tel"
              disabled={isPending}
              {...register("mobile", { setValueAs: (v: string) => (v?.trim() ? v : null) })}
            />
            {errors.mobile ? (
              <p className="text-sm text-destructive">{errors.mobile.message}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-md border border-border p-4">
        <h2 className="text-sm font-medium">{dict.professionalSection}</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="specializationId">
            {dict.specialization} <span className="text-destructive">*</span>
          </Label>
          <CreatableCombobox
            id="specializationId"
            placeholder={dict.selectOrAddSpecialization}
            options={specializations}
            value={specializationId || null}
            onChange={(next) => setValue("specializationId", next ?? "", { shouldValidate: true })}
            onCreate={async (name) => {
              const created = await createLookupOption("specialization", name);
              if (!created) return null;
              setSpecializations((prev) =>
                prev.some((s) => s.id === created.id) ? prev : [...prev, created],
              );
              return created;
            }}
            addLabel={dict.addNew}
            noMatchesLabel={dict.noMatches}
            disabled={isPending}
          />
          {errors.specializationId ? (
            <p className="text-sm text-destructive">{errors.specializationId.message}</p>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-md border border-border p-4">
        <h2 className="text-sm font-medium">{dict.territorySection}</h2>
        <div className="flex flex-col gap-1">
          <TerritoryPicker
            id="territoryId"
            label={`${dict.territory} *`}
            placeholder={territoryDict.selectTerritoryFilter}
            clearLabel={territoryDict.anyTerritoryFilter}
            noResultsLabel={territoryDict.noMatches}
            options={options.territories}
            value={territoryId || null}
            onChange={(next) => setValue("territoryId", next ?? "", { shouldValidate: true })}
            disabled={isPending}
          />
          {errors.territoryId ? (
            <p className="text-sm text-destructive">{errors.territoryId.message}</p>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-md border border-border p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">{dict.centersSection}</h2>
          <p className="text-xs text-muted-foreground">{dict.centerRelationNote}</p>
        </div>
        <CenterAssociationEditor
          centers={options.centers}
          roles={toOptions(options.centerRoles)}
          value={centers}
          onChange={(next) => setValue("centers", next, { shouldDirty: true })}
          dict={dict}
          disabled={isPending}
        />
      </section>

      {mode === "edit" ? (
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <div className="flex flex-col">
            <Label htmlFor="status">{dict.statusSwitchLabel}</Label>
            <span className="text-xs text-muted-foreground">
              {status === "INACTIVE" ? dict.inactiveDescription : dict.activeDescription}
            </span>
          </div>
          <Switch
            id="status"
            disabled={isPending}
            checked={status !== "INACTIVE"}
            onCheckedChange={(checked) =>
              setValue("status", checked ? "ACTIVE" : "INACTIVE", { shouldDirty: true })
            }
          />
        </div>
      ) : null}

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => router.push("/admin/persons")}
        >
          {dict.cancel}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? dict.saving : mode === "create" ? dict.createPerson : dict.saveChanges}
        </Button>
      </div>
    </form>
  );
}
