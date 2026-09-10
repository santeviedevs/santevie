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
import {
  type CreateUserInput,
  createUserSchema,
  type UpdateUserInput,
  updateUserSchema,
} from "@/lib/schemas/user";

import { createUserAction, updateUserAction, type UserFormState } from "./actions";

type Option = { id: string; name: string };

type UserFormProps = {
  mode: "create" | "edit";
  options: { roles: Option[]; territories: Option[]; managers: Option[] };
  defaultValues?: Partial<CreateUserInput> & { id?: string };
};

const NONE = "__none__";

export function UserForm({ mode, options, defaultValues }: UserFormProps) {
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
    defaultValues,
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
  const homeTerritoryId = watch("homeTerritoryId");

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
      if (values.homeTerritoryId) formData.set("homeTerritoryId", values.homeTerritoryId);

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

      toast.success(mode === "create" ? "User created" : "User updated");
      router.push("/admin/users");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-md flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="employeeCode">Employee code</Label>
        <Input id="employeeCode" disabled={isPending} {...register("employeeCode")} />
        {errors.employeeCode ? (
          <p className="text-sm text-destructive">{errors.employeeCode.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" disabled={isPending} {...register("name")} />
        {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" disabled={isPending} {...register("email")} />
        {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="roleId">Role</Label>
        <Select
          items={options.roles.map((role) => ({ value: role.id, label: role.name }))}
          value={roleId ?? ""}
          onValueChange={(value) => {
            if (value) setValue("roleId", value, { shouldValidate: true });
          }}
          disabled={isPending}
        >
          <SelectTrigger id="roleId" className="w-full">
            <SelectValue placeholder="Select a role" />
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
        <Label htmlFor="managerId">Manager</Label>
        <Select
          items={[
            { value: NONE, label: "No manager" },
            ...options.managers.map((manager) => ({ value: manager.id, label: manager.name })),
          ]}
          value={managerId ?? NONE}
          onValueChange={(value) =>
            setValue("managerId", value === NONE ? null : value, { shouldValidate: true })
          }
          disabled={isPending}
        >
          <SelectTrigger id="managerId" className="w-full">
            <SelectValue placeholder="No manager" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No manager</SelectItem>
            {options.managers.map((manager) => (
              <SelectItem key={manager.id} value={manager.id}>
                {manager.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="homeTerritoryId">Home territory</Label>
        <Select
          items={[
            { value: NONE, label: "No home territory" },
            ...options.territories.map((territory) => ({
              value: territory.id,
              label: territory.name,
            })),
          ]}
          value={homeTerritoryId ?? NONE}
          onValueChange={(value) =>
            setValue("homeTerritoryId", value === NONE ? null : value, { shouldValidate: true })
          }
          disabled={isPending}
        >
          <SelectTrigger id="homeTerritoryId" className="w-full">
            <SelectValue placeholder="No home territory" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No home territory</SelectItem>
            {options.territories.map((territory) => (
              <SelectItem key={territory.id} value={territory.id}>
                {territory.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : mode === "create" ? "Create user" : "Save changes"}
      </Button>
    </form>
  );
}
