"use client";

import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Dictionary } from "@/lib/i18n/dictionary";

type Dict = Dictionary["emballagePage"];
type Option = { id: string; label: string };

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function currentYearOptions(): number[] {
  const year = new Date().getUTCFullYear();
  return [year - 1, year, year + 1];
}

// URL-driven filters (month, year, centre, product) — same convention as
// ActivityFilters/FollowUpFilters: state lives in the query string, so
// back-navigation and the export link always agree with what's on screen.
// Month/year always have a value (the report needs a period to run
// against); "Clear filters" only ever resets centre/product, not the
// period itself.
export function ReportFilters({
  periodMonth,
  periodYear,
  centerId,
  productId,
  centers,
  products,
  dict,
}: {
  periodMonth: number;
  periodYear: number;
  centerId?: string;
  productId?: string;
  centers: Option[];
  products: Option[];
  dict: Dict;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }

  function clearFilters() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("centerId");
    next.delete("productId");
    router.push(`${pathname}?${next.toString()}`);
  }

  const hasActiveFilters = Boolean(centerId || productId);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reportMonth">{dict.reportMonthLabel}</Label>
        <Select
          items={MONTHS.map((m) => ({ value: String(m), label: String(m) }))}
          value={String(periodMonth)}
          onValueChange={(value) => setParam("periodMonth", value ?? undefined)}
        >
          <SelectTrigger id="reportMonth" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reportYear">{dict.reportYearLabel}</Label>
        <Select
          items={currentYearOptions().map((y) => ({ value: String(y), label: String(y) }))}
          value={String(periodYear)}
          onValueChange={(value) => setParam("periodYear", value ?? undefined)}
        >
          <SelectTrigger id="reportYear" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {currentYearOptions().map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reportCenter">{dict.reportCenterFilterLabel}</Label>
        <Select
          items={[
            { value: "", label: dict.anyCenter },
            ...centers.map((c) => ({ value: c.id, label: c.label })),
          ]}
          value={centerId ?? ""}
          onValueChange={(value) => setParam("centerId", value || undefined)}
        >
          <SelectTrigger id="reportCenter" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{dict.anyCenter}</SelectItem>
            {centers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reportProduct">{dict.reportProductFilterLabel}</Label>
        <Select
          items={[
            { value: "", label: dict.anyProduct },
            ...products.map((p) => ({ value: p.id, label: p.label })),
          ]}
          value={productId ?? ""}
          onValueChange={(value) => setParam("productId", value || undefined)}
        >
          <SelectTrigger id="reportProduct" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{dict.anyProduct}</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasActiveFilters ? (
        <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
          <X aria-hidden />
          {dict.clearFilters}
        </Button>
      ) : null}
    </div>
  );
}
