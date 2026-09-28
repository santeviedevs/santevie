"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { ProductFilters as ProductFiltersValue } from "@/lib/schemas/product";

type ProductCategory = { id: string; name: string };

type FilterKey = "q" | "categoryId" | "status" | "sort";

export function ProductFilters({
  categories,
  filters,
  dict,
}: {
  categories: ProductCategory[];
  filters: ProductFiltersValue;
  dict: Dictionary["productFilters"];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // True for the one filters.q change this component's own debounce just
  // caused — skipped so the sync effect below doesn't fight typing still in
  // progress. Any other filters.q change (browser back/forward, another
  // filter reading a stale value) still resyncs the field to match the URL.
  const ownSearchUpdateRef = useRef(false);
  // Captured once via useState's lazy initializer (a ref can't be read
  // during render under this project's lint rules) — passed to Input's
  // `defaultValue` below, which must never change after mount (React/Base UI
  // only reads it at mount time; feeding it a new value on every re-render
  // is what triggered the "changing the default value of an uncontrolled
  // FieldControl" warning). Every update after mount goes through the sync
  // effect instead, imperatively; the setter here is never called again.
  const [initialQ] = useState(filters.q);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (ownSearchUpdateRef.current) {
      ownSearchUpdateRef.current = false;
      return;
    }
    if (inputRef.current && inputRef.current.value !== (filters.q ?? "")) {
      inputRef.current.value = filters.q ?? "";
    }
  }, [filters.q]);

  function applyFilters(next: Partial<Record<FilterKey, string | null>>) {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const merged: Record<FilterKey, string> = {
      q: inputRef.current?.value ?? "",
      categoryId: filters.categoryId ?? "",
      status: filters.status ?? "",
      sort: filters.sort ?? "",
      ...Object.fromEntries(
        Object.entries(next)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, value ?? ""]),
      ),
    };

    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.categoryId) params.set("categoryId", merged.categoryId);
    if (merged.status) params.set("status", merged.status);
    if (merged.sort) params.set("sort", merged.sort);

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function handleSearchChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      ownSearchUpdateRef.current = true;
      applyFilters({ q: value });
    }, 400);
  }

  function clearFilters() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (inputRef.current) inputRef.current.value = "";
    router.push(pathname);
  }

  const hasActiveFilters = Boolean(
    filters.q || filters.categoryId || filters.status || filters.sort,
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="q" className="text-xs text-muted-foreground">
          {dict.searchLabel}
        </label>
        <Input
          id="q"
          ref={inputRef}
          defaultValue={initialQ}
          onChange={(event) => handleSearchChange(event.target.value)}
          placeholder={dict.searchPlaceholder}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="categoryId" className="text-xs text-muted-foreground">
          {dict.categoryLabel}
        </label>
        <Select
          items={[
            { value: "", label: dict.anyCategory },
            ...categories.map((category) => ({ value: category.id, label: category.name })),
          ]}
          value={filters.categoryId ?? ""}
          onValueChange={(value) => applyFilters({ categoryId: value ?? "" })}
        >
          <SelectTrigger id="categoryId" className="w-40">
            <SelectValue placeholder={dict.anyCategory} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{dict.anyCategory}</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="sort" className="text-xs text-muted-foreground">
          {dict.sortLabel}
        </label>
        <Select
          items={[
            { value: "", label: dict.sortDefault },
            { value: "priceAsc", label: dict.sortPriceAsc },
            { value: "priceDesc", label: dict.sortPriceDesc },
          ]}
          value={filters.sort ?? ""}
          onValueChange={(value) => applyFilters({ sort: value ?? "" })}
        >
          <SelectTrigger id="sort" className="w-44">
            <SelectValue placeholder={dict.sortDefault} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{dict.sortDefault}</SelectItem>
            <SelectItem value="priceAsc">{dict.sortPriceAsc}</SelectItem>
            <SelectItem value="priceDesc">{dict.sortPriceDesc}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="status" className="text-xs text-muted-foreground">
          {dict.statusLabel}
        </label>
        <Select
          items={[
            { value: "", label: dict.anyStatus },
            { value: "ACTIVE", label: dict.active },
            { value: "INACTIVE", label: dict.inactive },
          ]}
          value={filters.status ?? ""}
          onValueChange={(value) => applyFilters({ status: value ?? "" })}
        >
          <SelectTrigger id="status" className="w-36">
            <SelectValue placeholder={dict.anyStatus} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{dict.anyStatus}</SelectItem>
            <SelectItem value="ACTIVE">{dict.active}</SelectItem>
            <SelectItem value="INACTIVE">{dict.inactive}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasActiveFilters ? (
        <Button type="button" variant="ghost" onClick={clearFilters}>
          {dict.clearFilters}
        </Button>
      ) : null}
    </div>
  );
}
