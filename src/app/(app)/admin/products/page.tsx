import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getServerDictionary } from "@/lib/i18n/server";
import { productFiltersSchema } from "@/lib/schemas/product";
import { requirePermission } from "@/server/auth/require-permission";
import { getCurrentExchangeRate } from "@/server/services/exchange-rate-service";
import { listProductCategories, listProducts } from "@/server/services/product-service";

import { ProductFilters } from "./product-filters";
import { ProductsTable } from "./products-table";

// Admin-facing but still filtered per request; never let this be
// statically cached (execution plan, Section 4).
export const dynamic = "force-dynamic";

type ProductsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  await requirePermission("products:manage");

  const params = await searchParams;
  const filters = productFiltersSchema.parse({
    q: firstValue(params.q),
    categoryId: firstValue(params.categoryId),
    status: firstValue(params.status),
    sort: firstValue(params.sort),
  });

  const [products, categories, currentRate, dict] = await Promise.all([
    listProducts(filters),
    listProductCategories(),
    getCurrentExchangeRate(),
    getServerDictionary(),
  ]);
  const t = dict.productsPage;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t.title}</h1>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/admin/exchange-rate" />}>
            {t.exchangeRate}
          </Button>
          <Button variant="outline" render={<Link href="/admin/products/import" />}>
            {t.importButton}
          </Button>
          <Button render={<Link href="/admin/products/new" />}>{t.newProduct}</Button>
        </div>
      </div>

      <ProductFilters categories={categories} filters={filters} dict={dict.productFilters} />

      <ProductsTable products={products} currentRate={currentRate?.rate ?? null} dict={t} />
    </div>
  );
}
