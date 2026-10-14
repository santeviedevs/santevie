import { PaginationControls } from "@/components/pagination-controls";
import { getServerDictionary } from "@/lib/i18n/server";
import { DEFAULT_PAGE_SIZE, paginationParamsSchema, totalPages } from "@/lib/pagination";
import { followUpListParamsSchema } from "@/lib/schemas/follow-up";
import { hasPermission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";
import { listStandardEventActivityTypes } from "@/server/repositories/activity-repository";
import { getMyFollowUpsPage } from "@/server/services/follow-up-service";

import { FollowUpFilters } from "./follow-up-filters";
import { FollowUpTable } from "./follow-up-table";
import { FollowUpTabs } from "./follow-up-tabs";

export const dynamic = "force-dynamic";

type MyFollowUpsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

// My Follow-Ups: a filtered, paginated table of every follow-up the viewer
// currently owns, across every status by default — this is also the
// completed-follow-up history, not a PENDING-only work queue. `status` and
// `overdueOnly` narrow it when that's what's wanted.
export default async function MyFollowUpsPage({ searchParams }: MyFollowUpsPageProps) {
  const session = await requirePermission("activities:respond-own");
  const dict = await getServerDictionary();
  const t = dict.activitiesPage;

  const params = await searchParams;
  const pagination = paginationParamsSchema.parse({
    page: firstValue(params.page),
    pageSize: firstValue(params.pageSize) ?? String(DEFAULT_PAGE_SIZE),
  });
  const filters = followUpListParamsSchema.parse({
    q: firstValue(params.q),
    typeId: firstValue(params.typeId),
    status: firstValue(params.status),
    overdueOnly: firstValue(params.overdueOnly),
    from: firstValue(params.from),
    to: firstValue(params.to),
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  const asOf = new Date();
  const [result, typeOptions] = await Promise.all([
    getMyFollowUpsPage(session.user.id, pagination, filters, asOf),
    listStandardEventActivityTypes(),
  ]);
  const overdueIds = new Set(
    result.items
      .filter((f) => f.status === "PENDING" && f.dueDate.getTime() < asOf.getTime())
      .map((f) => f.id),
  );
  const anyFilter = Boolean(
    filters.q ||
    filters.typeId ||
    filters.status ||
    filters.overdueOnly ||
    filters.from ||
    filters.to,
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{t.myFollowUps}</h1>
      <FollowUpTabs
        active="mine"
        canViewTeam={hasPermission(session.user.permissions, "activities:view-team")}
        dict={t}
      />

      <FollowUpFilters filters={filters} typeOptions={typeOptions} dict={t} />

      <FollowUpTable
        rows={result.items}
        overdueIds={overdueIds}
        dict={t}
        emptyLabel={anyFilter ? t.noFollowUpsMatch : t.noFollowUps}
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
    </div>
  );
}
