"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
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
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { type ApplyLeaveInput, applyLeaveSchema } from "@/lib/schemas/leave";

import { applyLeaveAction, type LeaveFormState } from "./actions";

type ApplyLeaveFormProps = {
  leaveTypes: { id: string; name: string }[];
  dict: Dictionary["leaveForm"];
};

export function ApplyLeaveForm({ leaveTypes, dict }: ApplyLeaveFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<ApplyLeaveInput>({
    resolver: zodResolver(applyLeaveSchema),
  });

  const leaveTypeId = useWatch({ control, name: "leaveTypeId" });

  const onSubmit = (values: ApplyLeaveInput) => {
    setFormError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("leaveTypeId", values.leaveTypeId);
      formData.set("startDate", values.startDate);
      formData.set("endDate", values.endDate);
      if (values.reason) formData.set("reason", values.reason);

      const result: LeaveFormState = await applyLeaveAction({ error: null }, formData);

      if (result.sessionExpired) {
        router.push("/login?callbackUrl=/leaves/my/new");
        return;
      }

      if (result.error) {
        setFormError(result.error);
        return;
      }

      toast.success(dict.title);
      router.push("/leaves/my");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-md flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="leaveTypeId">{dict.leaveType}</Label>
        <Select
          items={leaveTypes.map((type) => ({ value: type.id, label: type.name }))}
          value={leaveTypeId ?? ""}
          onValueChange={(value) => {
            if (value) setValue("leaveTypeId", value, { shouldValidate: true });
          }}
          disabled={isPending}
        >
          <SelectTrigger id="leaveTypeId" className="w-full">
            <SelectValue placeholder={dict.selectLeaveType} />
          </SelectTrigger>
          <SelectContent>
            {leaveTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.leaveTypeId ? (
          <p className="text-sm text-destructive">{errors.leaveTypeId.message}</p>
        ) : null}
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
        <Label htmlFor="reason">{dict.reason}</Label>
        <Textarea id="reason" disabled={isPending} {...register("reason")} />
        {errors.reason ? <p className="text-sm text-destructive">{errors.reason.message}</p> : null}
      </div>

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? dict.saving : dict.submit}
      </Button>
    </form>
  );
}
