import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getPlansForAssignment } from "@/server/services/plan-service";

import { PlanTabs } from "../plan-tabs";
import { AssignmentList } from "./assignment-list";

export const dynamic = "force-dynamic";

// Assignment — same reach as Plan Visits (own unassigned drafts, plus
// anything already assigned within the downstream chain), but focused
// purely on assigning/reassigning/cancelling — never content. Summary
// cards only; each "Assign"/"Reassign" navigates to the dedicated
// /plans/assign/[planId] page, which is the only place that actually
// writes.
export default async function PlanAssignmentPage() {
  const session = await requirePermission("plans:assign-team");
  const dict = await getServerDictionary();
  const t = dict.plansPage;

  const plans = await getPlansForAssignment(session.user.id, session.user.roleName);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PlanTabs active="assign" dict={t} />
      <h1 className="text-xl font-semibold">{t.assignmentTitle}</h1>
      <AssignmentList
        plans={plans.map((plan) => ({
          id: plan.id,
          date: plan.date ? plan.date.toISOString() : null,
          visitorName: plan.visitorName,
          items: plan.items,
        }))}
        dict={t}
      />
    </div>
  );
}
