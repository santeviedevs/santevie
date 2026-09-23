import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getCurrentExchangeRate } from "@/server/services/exchange-rate-service";
import { listProductCategories } from "@/server/services/product-service";

import { ProductForm } from "../product-form";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requirePermission("products:manage");

  const [categories, currentRate, dict] = await Promise.all([
    listProductCategories(),
    getCurrentExchangeRate(),
    getServerDictionary(),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{dict.productForm.newProductTitle}</h1>
      <ProductForm
        mode="create"
        categories={categories}
        currentRate={currentRate?.rate ?? null}
        dict={dict.productForm}
      />
    </div>
  );
}
