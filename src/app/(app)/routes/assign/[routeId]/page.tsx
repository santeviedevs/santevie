import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getRoutesForAssignment, listAssignableUsers } from "@/server/services/route-service";

import { AssignDetail } from "../assign-detail";

export const dynamic = "force-dynamic";

type AssignDetailPageProps = { params: Promise<{ routeId: string }> };

// The dedicated page for assigning/reassigning one specific route, or
// cancelling its assignment — the only place on the Assignment screen that
// actually writes. Reuses getRoutesForAssignment rather than a separate
// single-route fetch, so the authorization boundary matches the list
// exactly: not found here means not reachable, not "exists but hidden."
export default async function AssignDetailPage({ params }: AssignDetailPageProps) {
  const session = await requirePermission("routes:assign-team");
  const dict = await getServerDictionary();
  const t = dict.routesPage;
  const { routeId } = await params;

  const [routes, assignableUsers] = await Promise.all([
    getRoutesForAssignment(session.user.id, session.user.roleName),
    listAssignableUsers(session.user.id),
  ]);

  const route = routes.find((p) => p.id === routeId);
  if (!route) notFound();

  return (
    <div className="flex flex-col gap-6 p-6">
      <Button render={<Link href="/routes/assign" />} variant="outline" size="sm" className="w-fit">
        {t.backToAssignRoutes}
      </Button>

      <h1 className="text-xl font-semibold">
        {route.visitorName ?? t.unassignedLabel}
        {route.date ? ` — ${formatDate(route.date)}` : ""}
      </h1>

      <AssignDetail
        routeId={route.id}
        visitorName={route.visitorName}
        date={route.date ? route.date.toISOString() : null}
        items={route.items}
        users={assignableUsers.map((u) => ({
          id: u.id,
          label: u.id === session.user.id ? t.myselfOption : u.name,
        }))}
        dict={t}
      />
    </div>
  );
}
