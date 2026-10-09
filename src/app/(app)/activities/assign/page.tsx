import Link from "next/link";

import { PaginationControls } from "@/components/pagination-controls";
import { Button } from "@/components/ui/button";
import { getServerDictionary } from "@/lib/i18n/server";
import { DEFAULT_PAGE_SIZE, paginationParamsSchema, totalPages } from "@/lib/pagination";
import { requirePermission } from "@/server/auth/require-permission";
import {
  getActivitiesPageForViewer,
  listAssignableUsers,
} from "@/server/services/activity-service";

import { ActivityAssignmentList } from "../activity-assignment-list";
import { ActivityTabs } from "../activity-tabs";

export const dynamic = "force-dynamic";

type AssignmentPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ActivityAssignmentPage({ searchParams }: AssignmentPageProps) {
  const session = await requirePermission("activities:assign");
  const dict = await getServerDictionary();
  const t = dict.activitiesPage;

  const params = await searchParams;
  const pagination = paginationParamsSchema.parse({
    page: firstValue(params.page),
    pageSize: firstValue(params.pageSize) ?? String(DEFAULT_PAGE_SIZE),
  });
  const unassignedOnly = firstValue(params.unassigned) === "1";

  const [result, users] = await Promise.all([
    getActivitiesPageForViewer(session, true, pagination, { unassignedOnly }),
    listAssignableUsers(session),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{t.activityListTitle}</h1>
      <ActivityTabs active="assign" canAssign dict={t} />

      {/* Plain links, not client state: the filter lives in the URL so
          back-navigation restores it, and changing it lands on page 1. */}
      <div className="flex gap-2">
        <Button
          render={<Link href="/activities/assign" />}
          variant={unassignedOnly ? "outline" : "default"}
          size="sm"
        >
          {t.filterAll}
        </Button>
        <Button
          render={<Link href="/activities/assign?unassigned=1" />}
          variant={unassignedOnly ? "default" : "outline"}
          size="sm"
        >
          {t.filterUnassigned}
        </Button>
      </div>

      <ActivityAssignmentList
        activities={result.items.map((a) => ({
          id: a.id,
          type: a.type,
          date: a.date.toISOString(),
          status: a.status,
          center: a.center ? { name: a.center.name, code: a.center.code } : null,
          territory: a.territory ? { code: a.territory.code } : null,
          owner: a.owner,
        }))}
        users={users}
        dict={t}
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
