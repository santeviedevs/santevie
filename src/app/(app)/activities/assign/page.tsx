import { PaginationControls } from "@/components/pagination-controls";
import { getServerDictionary } from "@/lib/i18n/server";
import { totalPages } from "@/lib/pagination";
import { activityAssignmentFiltersSchema } from "@/lib/schemas/activity";
import { requirePermission } from "@/server/auth/require-permission";
import {
  getAssigneeFilterLabel,
  getAssignmentsPageForViewer,
} from "@/server/services/activity-service";

import { ActivityFilters } from "../activity-filters";
import { ActivityTabs } from "../activity-tabs";
import { ActivityAssignmentsTable } from "./activity-assignments-table";
import { AssignActivityForm } from "./assign-activity-form";

export const dynamic = "force-dynamic";

type AssignmentPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

// Assignment screen — the assignment form on top (any activity in scope can
// be picked there, since more than one person can be assigned to it at
// once), and underneath the filtered, paginated table of individual
// assignments within the actor's scope. A row opens that one assignment's
// Manage page, where reassign and cancel live, scoped to that assignment
// alone.
export default async function ActivityAssignmentPage({ searchParams }: AssignmentPageProps) {
  const session = await requirePermission("activities:assign");
  const dict = await getServerDictionary();
  const t = dict.activitiesPage;

  const params = await searchParams;
  const filters = activityAssignmentFiltersSchema.parse({
    q: firstValue(params.q),
    assigneeId: firstValue(params.assigneeId),
    type: firstValue(params.type),
    status: firstValue(params.status),
    from: firstValue(params.from),
    to: firstValue(params.to),
    page: firstValue(params.page),
    pageSize: firstValue(params.pageSize),
  });

  const [result, assigneeLabel] = await Promise.all([
    getAssignmentsPageForViewer(session, filters, filters),
    filters.assigneeId
      ? getAssigneeFilterLabel(filters.assigneeId, session.user.id, session)
      : Promise.resolve(null),
  ]);

  const anyFilter = Boolean(
    filters.q || filters.assigneeId || filters.type || filters.status || filters.from || filters.to,
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{t.activityListTitle}</h1>
      <ActivityTabs active="assign" canAssign dict={t} />

      <AssignActivityForm dict={t} />

      <section className="flex flex-col gap-4">
        <ActivityFilters filters={filters} assigneeLabel={assigneeLabel} showAssignee dict={t} />

        <ActivityAssignmentsTable
          assignments={result.items.map((assignment) => ({
            id: assignment.id,
            status: assignment.status,
            scheduledDate: assignment.scheduledDate.toISOString(),
            user: assignment.user,
            activity: {
              id: assignment.activity.id,
              name: assignment.activity.name,
              type: assignment.activity.type,
            },
          }))}
          dict={t}
          emptyLabel={anyFilter ? t.noAssignmentsMatch : t.noAssignmentsYet}
        />
      </section>

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
