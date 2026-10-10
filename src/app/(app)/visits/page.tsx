import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getMyVisits } from "@/server/services/route-service";

import { MyVisitsList } from "./my-visits-list";

export const dynamic = "force-dynamic";

// Visits — every route currently assigned to the viewer, regardless of
// who created or assigned it. Pure view-and-respond: reorder, mark
// Completed/Cancelled. No add/remove here at all — see routes/add for
// the one place that happens.
export default async function VisitsPage() {
  const session = await requirePermission("visits:respond-own");
  const dict = await getServerDictionary();
  const t = dict.routesPage;

  const routes = await getMyVisits(session.user.id);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{t.visitsTitle}</h1>

      <MyVisitsList
        routes={routes.map((route) => ({
          id: route.id,
          code: route.code,
          startDate: route.startDate ? route.startDate.toISOString() : null,
          endDate: route.endDate ? route.endDate.toISOString() : null,
          createdByName: route.createdBy !== session.user.id ? route.createdByName : null,
          items: route.items,
        }))}
        dict={t}
      />
    </div>
  );
}
