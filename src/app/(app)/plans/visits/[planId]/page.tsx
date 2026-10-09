import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getPlansForContent } from "@/server/services/plan-service";

import { enrichPlanForVisits, getAllTerritoryOptions } from "../enrich-plan";
import { PlanDraftEditor } from "../plan-draft-editor";
import { PlanLockedView } from "../plan-locked-view";

export const dynamic = "force-dynamic";

type SinglePlanPageProps = { params: Promise<{ planId: string }> };

// The dedicated page for building out or editing one specific plan.
// Reuses getPlansForContent rather than a separate single-plan fetch, so
// the authorization boundary is identical: if this plan isn't in the
// actor's editable list, it's treated as not found, never as "exists but
// you can't see it." While still editable, renders the local-draft Save
// editor; once locked (date started), a read-only view with per-item
// cancel.
export default async function SinglePlanPage({ params }: SinglePlanPageProps) {
  const session = await requirePermission("plans:assign-team");
  const dict = await getServerDictionary();
  const t = dict.plansPage;
  const { planId } = await params;

  const [plans, allTerritories] = await Promise.all([
    getPlansForContent(session.user.id, session.user.roleName),
    getAllTerritoryOptions(),
  ]);

  const plan = plans.find((p) => p.id === planId);
  if (!plan) notFound();

  const enrichedPlan = await enrichPlanForVisits(plan, allTerritories);

  return (
    <div className="flex flex-col gap-6 p-6">
      <Button render={<Link href="/plans/visits" />} variant="outline" size="sm" className="w-fit">
        {t.backToPlanVisits}
      </Button>

      <h1 className="text-xl font-semibold">{t.planVisitsTitle}</h1>

      {enrichedPlan.editable ? (
        <PlanDraftEditor
          planId={enrichedPlan.id}
          initialClientIds={enrichedPlan.items
            .filter((item) => item.status === "PENDING")
            .map((item) => item.client.id)}
          readOnlyItems={enrichedPlan.items.filter(
            (item): item is typeof item & { status: "COMPLETED" | "CANCELLED" } =>
              item.status === "COMPLETED" || item.status === "CANCELLED",
          )}
          availableClients={enrichedPlan.availableClients}
          territories={enrichedPlan.territories}
          dict={t}
        />
      ) : (
        <PlanLockedView items={enrichedPlan.items} dict={t} />
      )}
    </div>
  );
}
