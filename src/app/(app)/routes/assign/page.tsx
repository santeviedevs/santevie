import { PaginationControls } from "@/components/pagination-controls";
import { getServerDictionary } from "@/lib/i18n/server";
import { totalPages } from "@/lib/pagination";
import { routeFiltersSchema } from "@/lib/schemas/route";
import { todayInKinshasa } from "@/lib/week";
import { requirePermission } from "@/server/auth/require-permission";
import { getAssigneeFilterLabel, listRoutesForAssignment } from "@/server/services/route-service";

import { RouteTabs } from "../route-tabs";
import { AssignForm } from "./assign-form";
import { RouteFilters } from "./route-filters";
import { RoutesTable } from "./routes-table";

export const dynamic = "force-dynamic";

type RouteAssignmentPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

// Assign Routes — the assignment form on top (unassigned routes are picked
// there), and underneath the filtered, paginated table of existing route
// assignments within the actor's scope. A row opens that route's Manage page,
// where reassign and cancel live; every assignment goes through the same
// server-side rules.
export default async function RouteAssignmentPage({ searchParams }: RouteAssignmentPageProps) {
  const session = await requirePermission("routes:assign-team");
  const dict = await getServerDictionary();
  const t = dict.routesPage;

  const params = await searchParams;
  const filters = routeFiltersSchema.parse({
    q: firstValue(params.q),
    assigneeId: firstValue(params.assigneeId),
    status: firstValue(params.status),
    from: firstValue(params.from),
    to: firstValue(params.to),
    page: firstValue(params.page),
    pageSize: firstValue(params.pageSize),
  });

  const [{ items: routes, total }, assigneeLabel] = await Promise.all([
    listRoutesForAssignment(filters, session.user.id, session.user.roleName),
    filters.assigneeId
      ? getAssigneeFilterLabel(filters.assigneeId, session.user.id, session.user.roleName)
      : Promise.resolve(null),
  ]);

  const anyFilter = Boolean(
    filters.q || filters.assigneeId || filters.status || filters.from || filters.to,
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <RouteTabs active="assign" dict={t} />
      <AssignForm minDate={todayInKinshasa().toISOString().slice(0, 10)} dict={t} />

      <section className="flex flex-col gap-4" aria-labelledby="route-assignments-heading">
        <h2 id="route-assignments-heading" className="text-lg font-semibold">
          {t.routeAssignmentsHeading}
        </h2>

        <RouteFilters filters={filters} assigneeLabel={assigneeLabel} dict={t} />

        <RoutesTable
          routes={routes}
          dict={t}
          emptyLabel={anyFilter ? t.noRoutesMatch : t.noAssignmentsYet}
        />
      </section>

      <PaginationControls
        page={filters.page}
        pageSize={filters.pageSize}
        total={total}
        previousLabel={dict.pagination.previous}
        nextLabel={dict.pagination.next}
        pageInfoLabel={dict.pagination.pageInfo(
          filters.page,
          totalPages(total, filters.pageSize),
          total,
        )}
      />
    </div>
  );
}
