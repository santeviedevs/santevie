import { notFound } from "next/navigation";

import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getCurrentExchangeRate } from "@/server/services/exchange-rate-service";
import { getProduct, listProductCategories } from "@/server/services/product-service";

import { ProductForm } from "../../product-form";

export const dynamic = "force-dynamic";

type EditProductPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditProductPage({ params }: EditProductPageProps) {
  await requirePermission("products:manage");

  const { id } = await params;
  const [product, categories, currentRate, dict] = await Promise.all([
    getProduct(id),
    listProductCategories(),
    getCurrentExchangeRate(),
    getServerDictionary(),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{dict.editProductTitle(product.name)}</h1>
      <ProductForm
        mode="edit"
        categories={categories}
        currentRate={currentRate?.rate ?? null}
        dict={dict.productForm}
        defaultValues={{
          id: product.id,
          code: product.code,
          name: product.name,
          categoryId: product.category?.id ?? null,
          grossPrice: product.grossPrice,
          netPrice: product.netPrice,
          status: product.status,
        }}
      />
    </div>
  );
}
