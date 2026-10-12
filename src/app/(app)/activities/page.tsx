import Link from "next/link";
import { redirect } from "next/navigation";

import { PaginationControls } from "@/components/pagination-controls";
import { Button } from "@/components/ui/button";
import { getServerDictionary } from "@/lib/i18n/server";
import { DEFAULT_PAGE_SIZE, paginationParamsSchema, totalPages } from "@/lib/pagination";
import { activityListParamsSchema } from "@/lib/schemas/activity";
import { hasPermission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";
import { getActivitiesPageForViewer } from "@/server/services/activity-service";

import { ActivityFilters } from "./activity-filters";
import { ActivityList } from "./activity-list";
import { ActivityTabs } from "./activity-tabs";

export const dynamic = "force-dynamic";

type ActivitiesPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

// The Activity List — browsing, creating and editing activity records. A
// manager action (activities:assign); anyone without it has no team list to
// see here and is sent to their own My Activities instead. Rows open the
// edit page; there are no inline respond actions here — those live on My
// Activities and nowhere else.
export default async function ActivitiesPage({ searchParams }: ActivitiesPageProps) {
  const session = await requirePermission("activities:respond-own");
  const canAssign = hasPermission(session.user.permissions, "activities:assign");
  if (!canAssign) redirect("/activities/my");

  const dict = await getServerDictionary();
  const t = dict.activitiesPage;

  const params = await searchParams;
  const pagination = paginationParamsSchema.parse({
    page: firstValue(params.page),
    pageSize: firstValue(params.pageSize) ?? String(DEFAULT_PAGE_SIZE),
  });
  const filters = activityListParamsSchema.parse({
    q: firstValue(params.q),
    type: firstValue(params.type),
    status: firstValue(params.status),
    from: firstValue(params.from),
    to: firstValue(params.to),
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  const result = await getActivitiesPageForViewer(session, true, pagination, filters);
  const anyFilter = Boolean(
    filters.q || filters.type || filters.status || filters.from || filters.to,
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t.activityListTitle}</h1>
        <Button render={<Link href="/activities/new" />}>{t.newActivityButton}</Button>
      </div>

      <ActivityTabs active="list" canAssign dict={t} />

      <ActivityFilters filters={filters} dict={t} />

      <ActivityList
        activities={result.items.map((activity) => ({
          id: activity.id,
          name: activity.name,
          type: activity.type,
          createdAt: activity.createdAt.toISOString(),
          assignments: activity.assignments,
          createdByName: activity.createdByName,
        }))}
        dict={t}
        emptyLabel={anyFilter ? t.noActivitiesMatch : t.noActivities}
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
