import { getServerDictionary } from "@/lib/i18n/server";
import { hasPermission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";
import { getMyVisits } from "@/server/services/plan-service";

import { MyVisitsList } from "./my-visits-list";
import { PlanTabs } from "./plan-tabs";

export const dynamic = "force-dynamic";

// "My Visits" — every plan currently assigned to the viewer, regardless of
// who created or assigned it. Pure view-and-respond: reorder, mark
// Completed/Cancelled. No add/remove here at all — see plans/visits for
// the one place that happens.
export default async function MyVisitsPage() {
  const session = await requirePermission("plans:respond-own");
  const dict = await getServerDictionary();
  const t = dict.plansPage;
  const canAssign = hasPermission(session.user.permissions, "plans:assign-team");

  const plans = await getMyVisits(session.user.id);

  return (
    <div className="flex flex-col gap-6 p-6">
      {canAssign ? <PlanTabs active="my-visits" dict={t} /> : null}

      <h1 className="text-xl font-semibold">{t.myVisitsTitle}</h1>

      <MyVisitsList
        plans={plans.map((plan) => ({
          id: plan.id,
          date: plan.date ? plan.date.toISOString() : null,
          createdByName: plan.createdBy !== session.user.id ? plan.createdByName : null,
          items: plan.items,
        }))}
        dict={t}
      />
    </div>
  );
}
