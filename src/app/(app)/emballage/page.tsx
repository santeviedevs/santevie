import { PaginationControls } from "@/components/pagination-controls";
import { getServerDictionary } from "@/lib/i18n/server";
import { DEFAULT_PAGE_SIZE, paginationParamsSchema, totalPages } from "@/lib/pagination";
import { emballageListParamsSchema } from "@/lib/schemas/emballage";
import { requirePermission } from "@/server/auth/require-permission";
import { listActiveCentersForSelection } from "@/server/repositories/center-repository";
import { listActiveProductsForSelection } from "@/server/repositories/product-repository";
import { getMyEmballageCollectionsPage } from "@/server/services/emballage-service";

import { EmballageForm } from "./emballage-form";
import { EmballageTable } from "./emballage-table";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

// My Collections: the create form for a new Emballage/Notice log entry,
// plus this delegate's own recent collections. No assignment/status/
// follow-up machinery — a simple repeatable log (§3.6).
export default async function EmballagePage({ searchParams }: PageProps) {
  const session = await requirePermission("emballage:record-own");
  const dict = await getServerDictionary();
  const t = dict.emballagePage;

  const params = await searchParams;
  const pagination = paginationParamsSchema.parse({
    page: firstValue(params.page),
    pageSize: firstValue(params.pageSize) ?? String(DEFAULT_PAGE_SIZE),
  });
  const filters = emballageListParamsSchema.parse({
    centerId: firstValue(params.centerId),
    productId: firstValue(params.productId),
    from: firstValue(params.from),
    to: firstValue(params.to),
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  const [result, centers, products] = await Promise.all([
    getMyEmballageCollectionsPage(session.user.id, pagination, filters),
    listActiveCentersForSelection(),
    listActiveProductsForSelection(),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{t.myCollections}</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">{t.logNew}</h2>
        <EmballageForm
          centers={centers.map((c) => ({ id: c.id, label: c.name }))}
          products={products.map((p) => ({ id: p.id, label: p.name }))}
          dict={t}
        />
      </section>

      <section className="flex flex-col gap-4">
        <EmballageTable rows={result.items} emptyLabel={t.noCollections} dict={t} />

        <PaginationControls
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          previousLabel={dict.pagination.previous}
          nextLabel={dict.pagination.next}
          pageInfoLabel={dict.pagination.pageInfo(
            result.page,
            totalPages(result.total, result.pageSize),
            result.total,
          )}
        />
      </section>
    </div>
  );
}
