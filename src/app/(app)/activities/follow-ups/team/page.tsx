import { PaginationControls } from "@/components/pagination-controls";
import { getServerDictionary } from "@/lib/i18n/server";
import { DEFAULT_PAGE_SIZE, paginationParamsSchema, totalPages } from "@/lib/pagination";
import { followUpListParamsSchema } from "@/lib/schemas/follow-up";
import { requirePermission } from "@/server/auth/require-permission";
import { listStandardEventActivityTypes } from "@/server/repositories/activity-repository";
import { getTeamFollowUpsPage } from "@/server/services/follow-up-service";

import { FollowUpFilters } from "../follow-up-filters";
import { FollowUpTable } from "../follow-up-table";
import { FollowUpTabs } from "../follow-up-tabs";

export const dynamic = "force-dynamic";

type TeamFollowUpsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

// Team Follow-Ups: every follow-up across the viewer's team, across every
// status by default — also the team's completed-follow-up history, not a
// PENDING-only work queue. Same filtered, paginated table as My
// Follow-Ups, with an Owner column since rows here span several delegates.
export default async function TeamFollowUpsPage({ searchParams }: TeamFollowUpsPageProps) {
  const session = await requirePermission("activities:view-team");
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
    getTeamFollowUpsPage(session, pagination, filters, asOf),
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
      <h1 className="text-xl font-semibold">{t.teamFollowUps}</h1>
      <FollowUpTabs active="team" canViewTeam dict={t} />

      <FollowUpFilters filters={filters} typeOptions={typeOptions} dict={t} />

      <FollowUpTable
        rows={result.items}
        overdueIds={overdueIds}
        dict={t}
        showOwner
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
