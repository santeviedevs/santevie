import { PaginationControls } from "@/components/pagination-controls";
import { getServerDictionary } from "@/lib/i18n/server";
import { DEFAULT_PAGE_SIZE, paginationParamsSchema, totalPages } from "@/lib/pagination";
import { prescriptionTargetListParamsSchema } from "@/lib/schemas/prescription";
import { requirePermission } from "@/server/auth/require-permission";
import { getTeamPrescriptionTargetsPage } from "@/server/services/prescription-service";

import { PrescriptionTargetTable } from "../prescription-target-table";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

// Scoped to the viewer's downstream team via getUserScope, same convention
// as every other Team screen (Emballage, Activities). Read-only — editing a
// target happens from its own detail page, gated independently.
export default async function TeamPrescriptionTargetsPage({ searchParams }: PageProps) {
  const session = await requirePermission("prescriptions:view-team");
  const dict = await getServerDictionary();
  const t = dict.prescriptionsPage;

  const params = await searchParams;
  const pagination = paginationParamsSchema.parse({
    page: firstValue(params.page),
    pageSize: firstValue(params.pageSize) ?? String(DEFAULT_PAGE_SIZE),
  });
  const filters = prescriptionTargetListParamsSchema.parse({
    contactId: firstValue(params.contactId),
    productId: firstValue(params.productId),
    periodMonth: firstValue(params.periodMonth),
    periodYear: firstValue(params.periodYear),
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  const result = await getTeamPrescriptionTargetsPage(session, pagination, filters);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{t.teamTargets}</h1>

      <section className="flex flex-col gap-4">
        <PrescriptionTargetTable
          rows={result.items}
          showDelegate
          emptyLabel={t.noTargets}
          dict={t}
        />

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
