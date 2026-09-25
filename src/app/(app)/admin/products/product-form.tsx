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
import { formatCdf } from "@/lib/format-money";
import type { Dictionary } from "@/lib/i18n/dictionary";
import {
  type CreateProductInput,
  createProductSchema,
  type UpdateProductInput,
  updateProductSchema,
} from "@/lib/schemas/product";

import { createProductAction, type ProductFormState, updateProductAction } from "./actions";

type ProductCategory = { id: string; name: string };

type ProductFormProps = {
  mode: "create" | "edit";
  categories: ProductCategory[];
  // Present when an exchange rate has ever been set — used only to preview
  // the CDF-converted price next to the USD inputs. Never stored: the
  // Product row only ever holds its USD prices (see the schema comment).
  currentRate: number | null;
  defaultValues?: Partial<UpdateProductInput>;
  dict: Dictionary["productForm"];
};

export function ProductForm({
  mode,
  categories,
  currentRate,
  defaultValues,
  dict,
}: ProductFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  // A convenience-only input: typing a discount % recalculates netPrice
  // from grossPrice, but netPrice stays a normal, independently editable
  // field — nothing here is enforced server-side (see product.ts: gross
  // and net are stored exactly as entered, never derived from a formula).
  const [discountPercent, setDiscountPercent] = useState("");

  const schema = mode === "create" ? createProductSchema : updateProductSchema;
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateProductInput | UpdateProductInput>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const categoryId = watch("categoryId");
  const grossPrice = watch("grossPrice");
  const netPrice = watch("netPrice");
  const status = watch("status");

  function applyDiscountPercent(percentText: string) {
    setDiscountPercent(percentText);
    const percent = Number(percentText);
    if (!Number.isFinite(percent) || typeof grossPrice !== "number") return;
    const computed = Math.round(grossPrice * (1 - percent / 100) * 1000) / 1000;
    setValue("netPrice", computed, { shouldValidate: true });
  }

  const onSubmit = (values: CreateProductInput | UpdateProductInput) => {
    setFormError(null);
    startTransition(async () => {
      const formData = new FormData();
      if ("id" in values && values.id) formData.set("id", values.id);
      formData.set("code", values.code);
      formData.set("name", values.name);
      if (values.categoryId) formData.set("categoryId", values.categoryId);
      formData.set("grossPrice", String(values.grossPrice));
      formData.set("netPrice", String(values.netPrice));
      if (mode === "edit" && "status" in values && values.status) {
        formData.set("status", values.status);
      }

      const action = mode === "create" ? createProductAction : updateProductAction;
      const result: ProductFormState = await action({ error: null }, formData);

      if (result.sessionExpired) {
        router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
        return;
      }

      if (result.error) {
        setFormError(result.error);
        return;
      }

      toast.success(mode === "create" ? dict.productCreated : dict.productUpdated);
      router.push("/admin/products");
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
        <Label htmlFor="categoryId">{dict.category}</Label>
        <Select
          items={[
            { value: "", label: dict.noCategory },
            ...categories.map((category) => ({ value: category.id, label: category.name })),
          ]}
          value={categoryId ?? ""}
          onValueChange={(value) => setValue("categoryId", value || null)}
          disabled={isPending}
        >
          <SelectTrigger id="categoryId" className="w-full">
            <SelectValue placeholder={dict.noCategory} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{dict.noCategory}</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="grossPrice">{dict.grossPrice}</Label>
        <Input
          id="grossPrice"
          type="number"
          step="0.001"
          min="0"
          disabled={isPending}
          {...register("grossPrice", { valueAsNumber: true })}
        />
        {errors.grossPrice ? (
          <p className="text-sm text-destructive">{errors.grossPrice.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="discountPercent">{dict.discountPercentHelper}</Label>
        <Input
          id="discountPercent"
          type="number"
          step="0.1"
          min="0"
          max="100"
          disabled={isPending}
          value={discountPercent}
          onChange={(event) => applyDiscountPercent(event.target.value)}
          placeholder={dict.discountPercentPlaceholder}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="netPrice">{dict.netPrice}</Label>
        <Input
          id="netPrice"
          type="number"
          step="0.001"
          min="0"
          disabled={isPending}
          {...register("netPrice", { valueAsNumber: true })}
        />
        {errors.netPrice ? (
          <p className="text-sm text-destructive">{errors.netPrice.message}</p>
        ) : null}
        {currentRate && typeof netPrice === "number" ? (
          <p className="text-xs text-muted-foreground">
            {dict.cdfPreviewLabel} {formatCdf(netPrice * currentRate)}
          </p>
        ) : null}
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
        {isPending ? dict.saving : mode === "create" ? dict.createProduct : dict.saveChanges}
      </Button>
    </form>
  );
}
