import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getRoutesForAssignment } from "@/server/services/route-service";

import { RouteTabs } from "../route-tabs";
import { AssignmentList } from "./assignment-list";

export const dynamic = "force-dynamic";

// Assignment — same reach as Plan Routes (own unassigned drafts, plus
// anything already assigned within the downstream chain), but focused
// purely on assigning/reassigning/cancelling — never content. Summary
// cards only; each "Assign"/"Reassign" navigates to the dedicated
// /routes/assign/[routeId] page, which is the only place that actually
// writes.
export default async function RouteAssignmentPage() {
  const session = await requirePermission("routes:assign-team");
  const dict = await getServerDictionary();
  const t = dict.routesPage;

  const routes = await getRoutesForAssignment(session.user.id, session.user.roleName);

  return (
    <div className="flex flex-col gap-6 p-6">
      <RouteTabs active="assign" dict={t} />
      <h1 className="text-xl font-semibold">{t.assignRoutesTitle}</h1>
      <AssignmentList
        routes={routes.map((route) => ({
          id: route.id,
          date: route.date ? route.date.toISOString() : null,
          visitorName: route.visitorName,
          items: route.items,
        }))}
        dict={t}
      />
    </div>
  );
}
