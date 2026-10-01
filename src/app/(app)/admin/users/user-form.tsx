"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
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
import { Switch } from "@/components/ui/switch";
import { computeContractExpiry } from "@/lib/contract-duration";
import { formatDate } from "@/lib/format-date";
import type { Dictionary } from "@/lib/i18n/dictionary";
import {
  type CreateUserInput,
  createUserSchema,
  type UpdateUserInput,
  updateUserSchema,
} from "@/lib/schemas/user";

import { TerritoryPicker, type TerritoryPickerOption } from "../territories/territory-picker";
import { createUserAction, updateUserAction, type UserFormState } from "./actions";

type Option = { id: string; name: string };

type UserFormProps = {
  mode: "create" | "edit";
  options: {
    roles: Option[];
    territories: TerritoryPickerOption[];
    managers: Option[];
  };
  defaultValues?: Partial<UpdateUserInput>;
  dict: Dictionary["userForm"];
  territoryDict: Dictionary["territory"];
};

const NONE = "__none__";

export function UserForm({ mode, options, defaultValues, dict, territoryDict }: UserFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const draftKey = `user-form-draft:${pathname}`;
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const schema = mode === "create" ? createUserSchema : updateUserSchema;
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateUserInput | UpdateUserInput>({
    resolver: zodResolver(schema),
    defaultValues: { status: "ACTIVE", ...defaultValues },
  });

  // If a session-expiry redirect left a draft behind for this exact page,
  // restore it once and discard it — it's meant to survive one re-login,
  // not linger and reappear on a later, unrelated visit to this form.
  useEffect(() => {
    const saved = sessionStorage.getItem(draftKey);
    if (saved) {
      reset(JSON.parse(saved) as CreateUserInput | UpdateUserInput);
      sessionStorage.removeItem(draftKey);
    }
  }, [draftKey, reset]);

  const roleId = watch("roleId");
  const managerId = watch("managerId");
  const territoryId = watch("territoryId");
  const status = watch("status");
  const contractStartDate = watch("contractStartDate");
  const contractDurationValue = watch("contractDurationValue");
  const contractDurationUnit = watch("contractDurationUnit");

  // Preview only — the server recomputes and owns the stored expiry date
  // (see the comment on contractExpiryDate in user-service.ts).
  const contractExpiryPreview =
    contractStartDate && contractDurationValue && contractDurationUnit
      ? formatDate(
          computeContractExpiry(
            new Date(contractStartDate),
            contractDurationValue,
            contractDurationUnit,
          ),
        )
      : null;

  const onSubmit = (values: CreateUserInput | UpdateUserInput) => {
    setFormError(null);
    startTransition(async () => {
      const formData = new FormData();
      if ("id" in values && values.id) formData.set("id", values.id);
      formData.set("employeeCode", values.employeeCode);
      formData.set("name", values.name);
      formData.set("email", values.email);
      formData.set("roleId", values.roleId);
      if (values.managerId) formData.set("managerId", values.managerId);
      if (values.territoryId) formData.set("territoryId", values.territoryId);
      if (values.contractStartDate) formData.set("contractStartDate", values.contractStartDate);
      if (values.contractDurationValue) {
        formData.set("contractDurationValue", String(values.contractDurationValue));
      }
      if (values.contractDurationUnit) {
        formData.set("contractDurationUnit", values.contractDurationUnit);
      }
      // Only meaningful for edit — the create schema has no status field,
      // and a brand-new user is always created ACTIVE server-side anyway.
      if (mode === "edit" && "status" in values && values.status) {
        formData.set("status", values.status);
      }

      const action = mode === "create" ? createUserAction : updateUserAction;
      const result: UserFormState = await action({ error: null }, formData);

      if (result.sessionExpired) {
        sessionStorage.setItem(draftKey, JSON.stringify(values));
        router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
        return;
      }

      if (result.error) {
        setFormError(result.error);
        return;
      }

      toast.success(mode === "create" ? dict.userCreated : dict.userUpdated);
      router.push("/admin/users");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-md flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="employeeCode">{dict.employeeCode}</Label>
        <Input id="employeeCode" disabled={isPending} {...register("employeeCode")} />
        {errors.employeeCode ? (
          <p className="text-sm text-destructive">{errors.employeeCode.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{dict.name}</Label>
        <Input id="name" disabled={isPending} {...register("name")} />
        {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{dict.email}</Label>
        <Input id="email" type="email" disabled={isPending} {...register("email")} />
        {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="roleId">{dict.role}</Label>
        <Select
          items={options.roles.map((role) => ({ value: role.id, label: role.name }))}
          value={roleId ?? ""}
          onValueChange={(value) => {
            if (value) setValue("roleId", value, { shouldValidate: true });
          }}
          disabled={isPending}
        >
          <SelectTrigger id="roleId" className="w-full">
            <SelectValue placeholder={dict.selectRole} />
          </SelectTrigger>
          <SelectContent>
            {options.roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.roleId ? <p className="text-sm text-destructive">{errors.roleId.message}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="managerId">{dict.manager}</Label>
        <Select
          items={[
            { value: NONE, label: dict.noManager },
            ...options.managers.map((manager) => ({ value: manager.id, label: manager.name })),
          ]}
          value={managerId ?? NONE}
          onValueChange={(value) =>
            setValue("managerId", value === NONE ? null : value, { shouldValidate: true })
          }
          disabled={isPending}
        >
          <SelectTrigger id="managerId" className="w-full">
            <SelectValue placeholder={dict.noManager} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{dict.noManager}</SelectItem>
            {options.managers.map((manager) => (
              <SelectItem key={manager.id} value={manager.id}>
                {manager.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{dict.territorySectionLabel}</Label>
        <TerritoryPicker
          id="territoryId"
          label={territoryDict.territoryPickerLabel}
          placeholder={territoryDict.selectTerritoryFilter}
          clearLabel={territoryDict.anyTerritoryFilter}
          noResultsLabel={territoryDict.noMatches}
          options={options.territories}
          value={territoryId ?? null}
          onChange={(next) => setValue("territoryId", next)}
          disabled={isPending}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="contractStartDate">{dict.contractStartDate}</Label>
        <Input
          id="contractStartDate"
          type="date"
          disabled={isPending}
          {...register("contractStartDate")}
        />
        {errors.contractStartDate ? (
          <p className="text-sm text-destructive">{errors.contractStartDate.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="contractDurationValue">{dict.contractDuration}</Label>
        <div className="flex gap-2">
          <Input
            id="contractDurationValue"
            type="number"
            step="1"
            min="1"
            className="flex-1"
            disabled={isPending}
            {...register("contractDurationValue", { valueAsNumber: true })}
          />
          <Select
            items={[
              { value: "DAYS", label: dict.durationUnitDays },
              { value: "MONTHS", label: dict.durationUnitMonths },
              { value: "YEARS", label: dict.durationUnitYears },
            ]}
            value={contractDurationUnit ?? ""}
            onValueChange={(value) => {
              if (value) {
                setValue("contractDurationUnit", value as "DAYS" | "MONTHS" | "YEARS", {
                  shouldValidate: true,
                });
              }
            }}
            disabled={isPending}
          >
            <SelectTrigger id="contractDurationUnit" className="w-36">
              <SelectValue placeholder={dict.durationUnitMonths} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DAYS">{dict.durationUnitDays}</SelectItem>
              <SelectItem value="MONTHS">{dict.durationUnitMonths}</SelectItem>
              <SelectItem value="YEARS">{dict.durationUnitYears}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {errors.contractDurationValue ? (
          <p className="text-sm text-destructive">{errors.contractDurationValue.message}</p>
        ) : null}
      </div>

      {contractExpiryPreview ? (
        <div className="flex flex-col gap-2">
          <Label>{dict.contractExpiry}</Label>
          <p className="text-sm text-muted-foreground">{contractExpiryPreview}</p>
        </div>
      ) : null}

      {mode === "edit" ? (
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <div className="flex flex-col">
            <Label htmlFor="status">{dict.activate}</Label>
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

      <Button type="submit" disabled={isPending}>
        {isPending ? dict.saving : mode === "create" ? dict.createUser : dict.saveChanges}
      </Button>
    </form>
  );
}
