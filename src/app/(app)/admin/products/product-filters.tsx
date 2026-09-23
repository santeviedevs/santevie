"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

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

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

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
    debounceRef.current = setTimeout(() => applyFilters({ q: value }), 400);
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
          key={filters.q ?? ""}
          defaultValue={filters.q}
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
