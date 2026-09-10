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
  type CreateTerritoryInput,
  createTerritorySchema,
  type UpdateTerritoryInput,
  updateTerritorySchema,
} from "@/lib/schemas/territory";

import { createTerritoryAction, type TerritoryFormState, updateTerritoryAction } from "./actions";

type TerritoryFormProps = {
  mode: "create" | "edit";
  defaultValues?: Partial<CreateTerritoryInput> & { id?: string };
};

export function TerritoryForm({ mode, defaultValues }: TerritoryFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const draftKey = `territory-form-draft:${pathname}`;
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const schema = mode === "create" ? createTerritorySchema : updateTerritorySchema;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTerritoryInput | UpdateTerritoryInput>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  // If a session-expiry redirect left a draft behind for this exact page,
  // restore it once and discard it — it's meant to survive one re-login,
  // not linger and reappear on a later, unrelated visit to this form.
  useEffect(() => {
    const saved = sessionStorage.getItem(draftKey);
    if (saved) {
      reset(JSON.parse(saved) as CreateTerritoryInput | UpdateTerritoryInput);
      sessionStorage.removeItem(draftKey);
    }
  }, [draftKey, reset]);

  const onSubmit = (values: CreateTerritoryInput | UpdateTerritoryInput) => {
    setFormError(null);
    startTransition(async () => {
      const formData = new FormData();
      if ("id" in values && values.id) formData.set("id", values.id);
      formData.set("code", values.code);
      formData.set("name", values.name);

      const action = mode === "create" ? createTerritoryAction : updateTerritoryAction;
      const result: TerritoryFormState = await action({ error: null }, formData);

      if (result.sessionExpired) {
        sessionStorage.setItem(draftKey, JSON.stringify(values));
        router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
        return;
      }

      if (result.error) {
        setFormError(result.error);
        return;
      }

      toast.success(mode === "create" ? "Territory created" : "Territory updated");
      router.push("/admin/territories");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-md flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">Code</Label>
        <Input id="code" disabled={isPending} {...register("code")} />
        {errors.code ? <p className="text-sm text-destructive">{errors.code.message}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" disabled={isPending} {...register("name")} />
        {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
      </div>

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : mode === "create" ? "Create territory" : "Save changes"}
      </Button>
    </form>
  );
}
