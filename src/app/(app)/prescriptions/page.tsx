import { PaginationControls } from "@/components/pagination-controls";
import { getServerDictionary } from "@/lib/i18n/server";
import { DEFAULT_PAGE_SIZE, paginationParamsSchema, totalPages } from "@/lib/pagination";
import { prescriptionTargetListParamsSchema } from "@/lib/schemas/prescription";
import { requirePermission } from "@/server/auth/require-permission";
import { listActiveContactsForSelection } from "@/server/repositories/contact-repository";
import { listActiveProductsForSelection } from "@/server/repositories/product-repository";
import { getMyPrescriptionTargetsPage } from "@/server/services/prescription-service";

import { PrescriptionTargetForm } from "./prescription-target-form";
import { PrescriptionTargetTable } from "./prescription-target-table";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

// My Targets: the set-target form (manager-facing, only rendered when the
// viewer holds prescriptions:manage-targets) plus this delegate's own
// targets with live Target/Achieved/Remaining. Not an event — no
// Activity/ActivityAssignment row (§3.7/Story D).
export default async function PrescriptionsPage({ searchParams }: PageProps) {
  const session = await requirePermission("prescriptions:update-progress");
  const dict = await getServerDictionary();
  const t = dict.prescriptionsPage;

  const canManageTargets = session.user.permissions.includes("prescriptions:manage-targets");

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

  const [result, contacts, products] = await Promise.all([
    getMyPrescriptionTargetsPage(session.user.id, pagination, filters),
    canManageTargets ? listActiveContactsForSelection() : Promise.resolve([]),
    canManageTargets ? listActiveProductsForSelection() : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{t.myTargets}</h1>

      {canManageTargets ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">{t.setTarget}</h2>
          <PrescriptionTargetForm
            contacts={contacts.map((c) => ({ id: c.id, label: c.name }))}
            products={products.map((p) => ({ id: p.id, label: p.name }))}
            dict={t}
          />
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <PrescriptionTargetTable rows={result.items} emptyLabel={t.noTargets} dict={t} />

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
