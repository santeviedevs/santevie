import Link from "next/link";

import { PaginationControls } from "@/components/pagination-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import { getServerDictionary } from "@/lib/i18n/server";
import { DEFAULT_PAGE_SIZE, paginationParamsSchema, totalPages } from "@/lib/pagination";
import { hasPermission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";
import { getActivitiesPageForViewer } from "@/server/services/activity-service";

import { ActivityStatusButtons } from "./activity-status-buttons";
import { ActivityTabs } from "./activity-tabs";
import { AddFollowUpButton } from "./add-follow-up-button";

export const dynamic = "force-dynamic";

type ActivitiesPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// One route, two audiences: a manager (activities:assign) gets the full
// activity list with a create button; everyone else gets "My activities" —
// only what's assigned to them.
export default async function ActivitiesPage({ searchParams }: ActivitiesPageProps) {
  const session = await requirePermission("activities:respond-own");
  const dict = await getServerDictionary();
  const t = dict.activitiesPage;

  const params = await searchParams;
  const pagination = paginationParamsSchema.parse({
    page: firstValue(params.page),
    pageSize: firstValue(params.pageSize) ?? String(DEFAULT_PAGE_SIZE),
  });

  const canAssign = hasPermission(session.user.permissions, "activities:assign");
  const result = await getActivitiesPageForViewer(session, canAssign, pagination);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">
          {canAssign ? t.activityListTitle : t.myActivitiesTitle}
        </h1>
        {canAssign ? (
          <Button render={<Link href="/activities/new" />}>{t.newActivityButton}</Button>
        ) : null}
      </div>

      <ActivityTabs active={canAssign ? "list" : "mine"} canAssign={canAssign} dict={t} />

      {result.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.noActivities}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {result.items.map((activity) => {
            const mayRespond =
              activity.status === "PLANNED" &&
              activity.owner !== null &&
              (activity.owner.id === session.user.id || canAssign);

            return (
              <li
                key={activity.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-3"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{activity.type}</Badge>
                    <span className="text-sm font-medium">
                      {formatDate(activity.date)} —{" "}
                      {activity.center
                        ? `${activity.center.name} (${activity.center.code})`
                        : activity.territory?.code}
                    </span>
                    <Badge variant="outline">{activity.status}</Badge>
                  </div>
                  {canAssign ? (
                    <span className="text-xs text-muted-foreground">
                      {activity.owner
                        ? `${t.assignedToPrefix} ${activity.owner.name}`
                        : t.unassignedLabel}
                    </span>
                  ) : null}
                  {activity.notes ? (
                    <span className="text-xs text-muted-foreground">{activity.notes}</span>
                  ) : null}
                </div>

                {mayRespond ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <AddFollowUpButton activityId={activity.id} dict={t} />
                    <ActivityStatusButtons activityId={activity.id} dict={t} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

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
