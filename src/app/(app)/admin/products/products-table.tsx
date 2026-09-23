"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCdf, formatUsd } from "@/lib/format-money";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { ProductSummary } from "@/server/services/product-service";

type Currency = "USD" | "CDF";

// A display-only toggle — the fetched USD prices never change, and no
// request is made when switching. CDF conversion always uses the current
// rate (never a historical one): see the discussion on ExchangeRate in
// exchange-rate-service.ts — this list has no notion of "as of" a past
// date the way an order or report would.
export function ProductsTable({
  products,
  currentRate,
  dict,
}: {
  products: ProductSummary[];
  currentRate: number | null;
  dict: Dictionary["productsPage"];
}) {
  const [currency, setCurrency] = useState<Currency>("USD");

  function price(amount: number): string {
    if (currency === "USD" || !currentRate) return formatUsd(amount);
    return formatCdf(amount * currentRate);
  }

  return (
    <div className="flex flex-col gap-3">
      {currentRate ? (
        <div className="flex items-center gap-2 self-end">
          <Button
            type="button"
            variant={currency === "USD" ? "default" : "outline"}
            size="sm"
            onClick={() => setCurrency("USD")}
          >
            USD
          </Button>
          <Button
            type="button"
            variant={currency === "CDF" ? "default" : "outline"}
            size="sm"
            onClick={() => setCurrency("CDF")}
          >
            CDF
          </Button>
        </div>
      ) : null}

      <div className="min-w-0 rounded-md border border-border p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{dict.columnCode}</TableHead>
              <TableHead>{dict.columnName}</TableHead>
              <TableHead>{dict.columnCategory}</TableHead>
              <TableHead>{dict.columnGrossPrice}</TableHead>
              <TableHead>{dict.columnNetPrice}</TableHead>
              <TableHead>{dict.columnStatus}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>{product.code}</TableCell>
                <TableCell>{product.name}</TableCell>
                <TableCell>{product.category?.name ?? "—"}</TableCell>
                <TableCell>{price(product.grossPrice)}</TableCell>
                <TableCell>{price(product.netPrice)}</TableCell>
                <TableCell>
                  <Badge variant={product.status === "ACTIVE" ? "default" : "secondary"}>
                    {product.status === "ACTIVE" ? dict.statusActive : dict.statusInactive}
                  </Badge>
                </TableCell>
                <TableCell className="flex justify-end">
                  <Button
                    render={<Link href={`/admin/products/${product.id}/edit`} />}
                    variant="outline"
                    size="sm"
                  >
                    {dict.edit}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {dict.noResults}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
