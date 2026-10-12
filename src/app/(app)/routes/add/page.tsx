import Link from "next/link";

import { PaginationControls } from "@/components/pagination-controls";
import { Button } from "@/components/ui/button";
import { getServerDictionary } from "@/lib/i18n/server";
import { totalPages } from "@/lib/pagination";
import { routeListParamsSchema } from "@/lib/schemas/route";
import { requirePermission } from "@/server/auth/require-permission";
import { getAssigneeFilterLabel, listRoutesForContent } from "@/server/services/route-service";

import { RouteFilters } from "../route-filters";
import { RouteTabs } from "../route-tabs";
import { RouteList } from "./route-list";

export const dynamic = "force-dynamic";

type AddRoutesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

// Add Routes — the routes the actor may work on (their own unassigned drafts,
// plus anything already assigned within their downstream chain), newest
// first, one page at a time, narrowed by search, assignee and date range. A row opens the dedicated single-route page,
// which is the only place a route's content is built out and saved.
export default async function AddRoutesPage({ searchParams }: AddRoutesPageProps) {
  const session = await requirePermission("routes:assign-team");
  const dict = await getServerDictionary();
  const t = dict.routesPage;

  const params = await searchParams;
  const list = routeListParamsSchema.parse({
    q: firstValue(params.q),
    assigneeId: firstValue(params.assigneeId),
    from: firstValue(params.from),
    to: firstValue(params.to),
    page: firstValue(params.page),
    pageSize: firstValue(params.pageSize),
  });
  const [{ items: routes, total }, assigneeLabel] = await Promise.all([
    listRoutesForContent(list, session.user.id, session.user.roleName),
    list.assigneeId
      ? getAssigneeFilterLabel(list.assigneeId, session.user.id, session.user.roleName)
      : Promise.resolve(null),
  ]);
  const anyFilter = Boolean(list.q || list.assigneeId || list.from || list.to);

  return (
    <div className="flex flex-col gap-6 p-6">
      <RouteTabs active="route" dict={t} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t.routesListHeading}</h1>
        <Button render={<Link href="/routes/add/new" />}>{t.newRoute}</Button>
      </div>

      <RouteFilters filters={list} assigneeLabel={assigneeLabel} showStatus={false} dict={t} />

      <RouteList
        routes={routes}
        dict={t}
        emptyLabel={anyFilter ? t.noRoutesMatch : t.noRoutesYet}
      />

      <PaginationControls
        page={list.page}
        pageSize={list.pageSize}
        total={total}
        previousLabel={dict.pagination.previous}
        nextLabel={dict.pagination.next}
        pageInfoLabel={dict.pagination.pageInfo(list.page, totalPages(total, list.pageSize), total)}
      />
    </div>
  );
}
