"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import type { Dictionary } from "@/lib/i18n/dictionary";
import {
  type CreateClientInput,
  createClientSchema,
  type UpdateClientInput,
  updateClientSchema,
} from "@/lib/schemas/client";

import { TerritoryPicker, type TerritoryPickerOption } from "../territories/territory-picker";
import { type ClientFormState, createClientAction, updateClientAction } from "./actions";
import { CoordinateMapPicker } from "./coordinate-map-picker";
import { DoctorHospitalPicker } from "./doctor-hospital-picker";

type ClientType = { id: string; code: string; name: string };
type HospitalOption = { id: string; name: string; code: string };

type ClientFormProps = {
  mode: "create" | "edit";
  options: {
    types: ClientType[];
    territories: TerritoryPickerOption[];
    hospitalOptions: HospitalOption[];
  };
  defaultValues?: Partial<UpdateClientInput>;
  dict: Dictionary["clientForm"];
  territoryDict: Dictionary["territory"];
};

export function ClientForm({ mode, options, defaultValues, dict, territoryDict }: ClientFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const schema = mode === "create" ? createClientSchema : updateClientSchema;
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateClientInput | UpdateClientInput>({
    resolver: zodResolver(schema),
    defaultValues: { hospitalIds: [], ...defaultValues },
  });

  const typeId = watch("typeId");
  const territoryId = watch("territoryId");
  const latitude = watch("latitude");
  const longitude = watch("longitude");
  const status = watch("status");
  const hospitalIds = watch("hospitalIds") ?? [];

  const selectedType = options.types.find((t) => t.id === typeId);
  const typeCode = selectedType?.code;

  const onSubmit = (values: CreateClientInput | UpdateClientInput) => {
    setFormError(null);
    startTransition(async () => {
      const formData = new FormData();
      if ("id" in values && values.id) formData.set("id", values.id);
      formData.set("code", values.code);
      formData.set("name", values.name);
      formData.set("typeId", values.typeId);
      if (typeCode) formData.set("typeCode", typeCode);
      if (values.contact) formData.set("contact", values.contact);
      if (values.address) formData.set("address", values.address);
      if (values.latitude !== null && values.latitude !== undefined) {
        formData.set("latitude", String(values.latitude));
      }
      if (values.longitude !== null && values.longitude !== undefined) {
        formData.set("longitude", String(values.longitude));
      }
      if (values.territoryId) formData.set("territoryId", values.territoryId);
      if (typeCode === "DOCTOR" && values.doctor) {
        if (values.doctor.doctorType) formData.set("doctorType", values.doctor.doctorType);
        if (values.doctor.gender) formData.set("gender", values.doctor.gender);
        if (values.doctor.department) formData.set("department", values.doctor.department);
        if (values.doctor.mobileNo) formData.set("mobileNo", values.doctor.mobileNo);
        for (const hospitalId of values.hospitalIds ?? []) {
          formData.append("hospitalIds", hospitalId);
        }
      }
      if (typeCode === "HOSPITAL" && values.hospital?.hospitalCategory) {
        formData.set("hospitalCategory", values.hospital.hospitalCategory);
      }
      if (mode === "edit" && "status" in values && values.status) {
        formData.set("status", values.status);
      }

      const action = mode === "create" ? createClientAction : updateClientAction;
      const result: ClientFormState = await action({ error: null }, formData);

      if (result.sessionExpired) {
        router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
        return;
      }

      if (result.error) {
        setFormError(result.error);
        return;
      }

      toast.success(mode === "create" ? dict.clientCreated : dict.clientUpdated);
      router.push("/admin/clients");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-md flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">{dict.code}</Label>
        <Input id="code" disabled={isPending} {...register("code")} />
        {errors.code ? <p className="text-sm text-destructive">{errors.code.message}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{dict.name}</Label>
        <Input id="name" disabled={isPending} {...register("name")} />
        {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="typeId">{dict.type}</Label>
        <Select
          items={options.types.map((type) => ({ value: type.id, label: type.name }))}
          value={typeId ?? ""}
          onValueChange={(value) => {
            if (value) setValue("typeId", value, { shouldValidate: true });
          }}
          disabled={isPending}
        >
          <SelectTrigger id="typeId" className="w-full">
            <SelectValue placeholder={dict.selectType} />
          </SelectTrigger>
          <SelectContent>
            {options.types.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.typeId ? <p className="text-sm text-destructive">{errors.typeId.message}</p> : null}
      </div>

      {typeCode === "DOCTOR" ? (
        <div className="flex flex-col gap-4 rounded-md border border-border p-3">
          <Label>{dict.doctorSectionLabel}</Label>
          <div className="flex flex-col gap-2">
            <Label htmlFor="doctorType">{dict.doctorType}</Label>
            <Input id="doctorType" disabled={isPending} {...register("doctor.doctorType")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gender">{dict.gender}</Label>
            <Input id="gender" disabled={isPending} {...register("doctor.gender")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="department">{dict.department}</Label>
            <Input id="department" disabled={isPending} {...register("doctor.department")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="mobileNo">{dict.mobileNo}</Label>
            <Input id="mobileNo" disabled={isPending} {...register("doctor.mobileNo")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{dict.associatedHospitals}</Label>
            <DoctorHospitalPicker
              options={options.hospitalOptions}
              value={hospitalIds}
              onChange={(next) => setValue("hospitalIds", next)}
              disabled={isPending}
              emptyLabel={dict.noHospitals}
              searchPlaceholder={dict.searchHospitals}
              noMatchesLabel={dict.noHospitalsMatch}
            />
          </div>
        </div>
      ) : null}

      {typeCode === "HOSPITAL" ? (
        <div className="flex flex-col gap-4 rounded-md border border-border p-3">
          <Label>{dict.hospitalSectionLabel}</Label>
          <div className="flex flex-col gap-2">
            <Label htmlFor="hospitalCategory">{dict.hospitalCategory}</Label>
            <Input
              id="hospitalCategory"
              disabled={isPending}
              {...register("hospital.hospitalCategory")}
            />
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="contact">{dict.contact}</Label>
        <Input id="contact" disabled={isPending} {...register("contact")} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="address">{dict.address}</Label>
        <Input id="address" disabled={isPending} {...register("address")} />
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
        <Label>{dict.coordinatesLabel}</Label>
        <CoordinateMapPicker
          latitude={latitude ?? null}
          longitude={longitude ?? null}
          onChange={({ latitude: lat, longitude: lng }) => {
            setValue("latitude", lat, { shouldValidate: true });
            setValue("longitude", lng, { shouldValidate: true });
          }}
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          {latitude !== null &&
          latitude !== undefined &&
          longitude !== null &&
          longitude !== undefined
            ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
            : dict.noCoordinates}
        </p>
      </div>

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
        {isPending ? dict.saving : mode === "create" ? dict.createClient : dict.saveChanges}
      </Button>
    </form>
  );
}
