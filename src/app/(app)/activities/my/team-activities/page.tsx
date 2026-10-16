import { PaginationControls } from "@/components/pagination-controls";
import { getServerDictionary } from "@/lib/i18n/server";
import { totalPages } from "@/lib/pagination";
import { activityAssignmentFiltersSchema } from "@/lib/schemas/activity";
import { requirePermission } from "@/server/auth/require-permission";
import { listStandardEventActivityTypes } from "@/server/repositories/activity-repository";
import {
  getAssigneeFilterLabel,
  getAssignmentsPageForViewer,
} from "@/server/services/activity-service";

import { ActivityFilters } from "../../activity-filters";
import { MyActivitiesTabs } from "../my-activities-tabs";
import { TeamActivityTable } from "./team-activity-table";

export const dynamic = "force-dynamic";

type TeamActivitiesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

// Team Activities tab on the My Activities screen: the read-only
// counterpart to the manager-only Assignment screen — one row per
// assignment across the viewer's downstream team (ADMIN: everyone), reached
// by anyone holding activities:view-team, Supervisors included (who never
// get the Activities/Assignment/Calendar group, since that also requires
// activities:assign). A row links through to the delegate's own recorded
// results once something has been submitted; see
// activities/my/execute/[assignmentId] and assertCanViewAssignment, which
// grants this read reach without granting reassign/cancel/submit.
export default async function TeamActivitiesPage({ searchParams }: TeamActivitiesPageProps) {
  const session = await requirePermission("activities:view-team");
  const dict = await getServerDictionary();
  const t = dict.activitiesPage;

  const params = await searchParams;
  const filters = activityAssignmentFiltersSchema.parse({
    q: firstValue(params.q),
    assigneeId: firstValue(params.assigneeId),
    typeId: firstValue(params.typeId),
    status: firstValue(params.status),
    from: firstValue(params.from),
    to: firstValue(params.to),
    page: firstValue(params.page),
    pageSize: firstValue(params.pageSize),
  });

  const [result, assigneeLabel, typeOptions] = await Promise.all([
    getAssignmentsPageForViewer(session, filters, filters),
    filters.assigneeId
      ? getAssigneeFilterLabel(filters.assigneeId, session.user.id, session)
      : Promise.resolve(null),
    listStandardEventActivityTypes(),
  ]);

  const anyFilter = Boolean(
    filters.q ||
    filters.assigneeId ||
    filters.typeId ||
    filters.status ||
    filters.from ||
    filters.to,
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{t.teamActivitiesTitle}</h1>
      <MyActivitiesTabs active="team" canViewTeam dict={t} />

      <section className="flex flex-col gap-4">
        <ActivityFilters
          filters={filters}
          assigneeLabel={assigneeLabel}
          showAssignee
          typeOptions={typeOptions}
          dict={t}
        />

        <TeamActivityTable
          rows={result.items.map((assignment) => ({
            id: assignment.id,
            status: assignment.status,
            scheduledDate: assignment.scheduledDate.toISOString(),
            executionRecorded: assignment.executionRecordedAt !== null,
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
