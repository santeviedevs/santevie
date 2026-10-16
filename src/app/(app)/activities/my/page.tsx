import { PaginationControls } from "@/components/pagination-controls";
import { getServerDictionary } from "@/lib/i18n/server";
import { DEFAULT_PAGE_SIZE, paginationParamsSchema, totalPages } from "@/lib/pagination";
import { activityListParamsSchema } from "@/lib/schemas/activity";
import { hasPermission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";
import { listStandardEventActivityTypes } from "@/server/repositories/activity-repository";
import { getMyAssignmentsPage } from "@/server/services/activity-service";

import { ActivityFilters } from "../activity-filters";
import { MyActivitiesTabs } from "./my-activities-tabs";
import { MyActivityTable } from "./my-activity-table";

export const dynamic = "force-dynamic";

type MyActivitiesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

// My Activities — a standalone screen reachable from its own sidebar entry
// (Marketing > My Activities), separate from the Activities and Follow-Ups
// sidebar entries. One row per assignment the viewer holds, always scoped
// to themselves regardless of role, so a manager sees exactly their own
// work here, same as anyone else — the team-wide view is the separate
// Activity List / Assignment screens. A row opens the activity's read-only
// detail view; the inline respond actions (Add follow-up / Mark done /
// Cancel) live only here, never on that detail view or the main list.
export default async function MyActivitiesPage({ searchParams }: MyActivitiesPageProps) {
  const session = await requirePermission("activities:respond-own");
  const dict = await getServerDictionary();
  const t = dict.activitiesPage;
  const canViewTeam = hasPermission(session.user.permissions, "activities:view-team");

  const params = await searchParams;
  const pagination = paginationParamsSchema.parse({
    page: firstValue(params.page),
    pageSize: firstValue(params.pageSize) ?? String(DEFAULT_PAGE_SIZE),
  });
  const filters = activityListParamsSchema.parse({
    q: firstValue(params.q),
    typeId: firstValue(params.typeId),
    status: firstValue(params.status),
    from: firstValue(params.from),
    to: firstValue(params.to),
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  const [result, typeOptions] = await Promise.all([
    getMyAssignmentsPage(session, pagination, filters),
    listStandardEventActivityTypes(),
  ]);
  const anyFilter = Boolean(
    filters.q || filters.typeId || filters.status || filters.from || filters.to,
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{t.myActivitiesTitle}</h1>
      <MyActivitiesTabs active="activities" canViewTeam={canViewTeam} dict={t} />

      <ActivityFilters filters={filters} typeOptions={typeOptions} dict={t} />

      <MyActivityTable
        rows={result.items.map((assignment) => ({
          assignmentId: assignment.id,
          activityId: assignment.activity.id,
          activityName: assignment.activity.name,
          type: assignment.activity.type,
          status: assignment.status,
          scheduledDate: assignment.scheduledDate.toISOString(),
          executionRecorded: assignment.executionRecordedAt !== null,
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
