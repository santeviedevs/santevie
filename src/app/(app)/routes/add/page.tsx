import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getRoutesForContent } from "@/server/services/route-service";

import { RouteTabs } from "../route-tabs";
import { RouteList } from "./route-list";

export const dynamic = "force-dynamic";

// Plan Routes — the actor's own unassigned drafts plus anything already
// assigned within their downstream chain. Summary cards only; "New route"
// and each card's "Edit" link out to the dedicated single-route page, which
// is the only place content is actually built out and saved.
export default async function RouteVisitsPage() {
  const session = await requirePermission("routes:assign-team");
  const dict = await getServerDictionary();
  const t = dict.routesPage;

  const routes = await getRoutesForContent(session.user.id, session.user.roleName);

  return (
    <div className="flex flex-col gap-6 p-6">
      <RouteTabs active="route" dict={t} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t.planRoutesTitle}</h1>
        <Button render={<Link href="/routes/plan/new" />}>{t.newRoute}</Button>
      </div>
      <RouteList
        routes={routes.map((route) => ({
          id: route.id,
          code: route.code,
          startDate: route.startDate ? route.startDate.toISOString() : null,
          endDate: route.endDate ? route.endDate.toISOString() : null,
          visitorName: route.visitorName,
          editable: route.editable,
          items: route.items,
        }))}
        dict={t}
      />
    </div>
  );
}
