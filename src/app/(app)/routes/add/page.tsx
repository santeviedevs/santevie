import Link from "next/link";

import { PaginationControls } from "@/components/pagination-controls";
import { Button } from "@/components/ui/button";
import { getServerDictionary } from "@/lib/i18n/server";
import { totalPages } from "@/lib/pagination";
import { routeListParamsSchema } from "@/lib/schemas/route";
import { requirePermission } from "@/server/auth/require-permission";
import { listRoutesForContent } from "@/server/services/route-service";

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
// first, one page at a time. A row opens the dedicated single-route page,
// which is the only place a route's content is built out and saved.
export default async function AddRoutesPage({ searchParams }: AddRoutesPageProps) {
  const session = await requirePermission("routes:assign-team");
  const dict = await getServerDictionary();
  const t = dict.routesPage;

  const params = await searchParams;
  const list = routeListParamsSchema.parse({
    page: firstValue(params.page),
    pageSize: firstValue(params.pageSize),
  });
  const { items: routes, total } = await listRoutesForContent(
    list,
    session.user.id,
    session.user.roleName,
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <RouteTabs active="route" dict={t} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t.routesListHeading}</h1>
        <Button render={<Link href="/routes/add/new" />}>{t.newRoute}</Button>
      </div>

      <RouteList routes={routes} dict={t} />

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
