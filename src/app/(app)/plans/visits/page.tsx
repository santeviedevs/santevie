import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getPlansForContent } from "@/server/services/plan-service";

import { PlanTabs } from "../plan-tabs";
import { PlanVisitsList } from "./plan-visits-list";

export const dynamic = "force-dynamic";

// Plan Visits — the actor's own unassigned drafts plus anything already
// assigned within their downstream chain. Summary cards only; "New plan"
// and each card's "Edit" link out to the dedicated single-plan page, which
// is the only place content is actually built out and saved.
export default async function PlanVisitsPage() {
  const session = await requirePermission("plans:assign-team");
  const dict = await getServerDictionary();
  const t = dict.plansPage;

  const plans = await getPlansForContent(session.user.id, session.user.roleName);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PlanTabs active="visits" dict={t} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t.planVisitsTitle}</h1>
        <Button render={<Link href="/plans/visits/new" />}>{t.newPlan}</Button>
      </div>
      <PlanVisitsList
        plans={plans.map((plan) => ({
          id: plan.id,
          date: plan.date ? plan.date.toISOString() : null,
          visitorName: plan.visitorName,
          editable: plan.editable,
          items: plan.items,
        }))}
        dict={t}
      />
    </div>
  );
}
