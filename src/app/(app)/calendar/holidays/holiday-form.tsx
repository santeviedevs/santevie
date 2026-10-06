"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import type { Dictionary } from "@/lib/i18n/dictionary";
import {
  type CreateHolidayInput,
  createHolidaySchema,
  type UpdateHolidayInput,
  updateHolidaySchema,
} from "@/lib/schemas/holiday";

import { createHolidayAction, type HolidayFormState, updateHolidayAction } from "./actions";

type Option = { id: string; label: string };

type HolidayFormProps = {
  mode: "create" | "edit";
  territories: Option[];
  defaultValues?: Partial<UpdateHolidayInput>;
  dict: Dictionary["holidayForm"];
};

const ALL_TERRITORIES = "__all__";

export function HolidayForm({ mode, territories, defaultValues, dict }: HolidayFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const schema = mode === "create" ? createHolidaySchema : updateHolidaySchema;
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<CreateHolidayInput | UpdateHolidayInput>({
    resolver: zodResolver(schema),
    defaultValues: { status: "ACTIVE", ...defaultValues },
  });

  const territoryId = useWatch({ control, name: "territoryId" });
  const status = useWatch({ control, name: "status" });

  const onSubmit = (values: CreateHolidayInput | UpdateHolidayInput) => {
    setFormError(null);
    startTransition(async () => {
      const formData = new FormData();
      if ("id" in values && values.id) formData.set("id", values.id);
      formData.set("name", values.name);
      formData.set("startDate", values.startDate);
      formData.set("endDate", values.endDate);
      if (values.territoryId) formData.set("territoryId", values.territoryId);
      if (mode === "edit" && "status" in values && values.status) {
        formData.set("status", values.status);
      }

      const action = mode === "create" ? createHolidayAction : updateHolidayAction;
      const result: HolidayFormState = await action({ error: null }, formData);

      if (result.sessionExpired) {
        router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
        return;
      }

      if (result.error) {
        setFormError(result.error);
        return;
      }

      toast.success(mode === "create" ? dict.created : dict.updated);
      router.push("/calendar/holidays");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-md flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{dict.name}</Label>
        <Input id="name" disabled={isPending} {...register("name")} />
        {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="startDate">{dict.startDate}</Label>
        <Input id="startDate" type="date" disabled={isPending} {...register("startDate")} />
        {errors.startDate ? (
          <p className="text-sm text-destructive">{errors.startDate.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="endDate">{dict.endDate}</Label>
        <Input id="endDate" type="date" disabled={isPending} {...register("endDate")} />
        {errors.endDate ? (
          <p className="text-sm text-destructive">{errors.endDate.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="territoryId">{dict.territory}</Label>
        <Select
          items={[
            { value: ALL_TERRITORIES, label: dict.allTerritories },
            ...territories.map((territory) => ({ value: territory.id, label: territory.label })),
          ]}
          value={territoryId ?? ALL_TERRITORIES}
          onValueChange={(value) =>
            setValue("territoryId", value === ALL_TERRITORIES ? null : value)
          }
          disabled={isPending}
        >
          <SelectTrigger id="territoryId" className="w-full">
            <SelectValue placeholder={dict.allTerritories} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TERRITORIES}>{dict.allTerritories}</SelectItem>
            {territories.map((territory) => (
              <SelectItem key={territory.id} value={territory.id}>
                {territory.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {mode === "edit" ? (
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <Label htmlFor="status">{dict.activate}</Label>
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
        {isPending ? dict.saving : dict.save}
      </Button>
    </form>
  );
}
