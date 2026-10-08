import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";

import { enrichNewPlanDraft, getAllTerritoryOptions } from "../enrich-plan";
import { PlanDraftEditor } from "../plan-draft-editor";

export const dynamic = "force-dynamic";

// A brand-new plan's editor — fully local until Save, which is the only
// point anything is actually persisted (see savePlanContent). Nothing
// exists server-side yet, so there's no plan to fetch: territory/client
// scoping is derived straight from the actor.
export default async function NewPlanPage() {
  const session = await requirePermission("plans:assign-team");
  const dict = await getServerDictionary();
  const t = dict.plansPage;

  const allTerritories = await getAllTerritoryOptions();
  const draft = await enrichNewPlanDraft(session.user.id, allTerritories);

  return (
    <div className="flex flex-col gap-6 p-6">
      <Button render={<Link href="/plans/visits" />} variant="outline" size="sm" className="w-fit">
        {t.backToPlanVisits}
      </Button>

      <h1 className="text-xl font-semibold">{t.newPlanPageTitle}</h1>

      <PlanDraftEditor
        planId={null}
        initialClientIds={[]}
        readOnlyItems={[]}
        availableClients={draft.availableClients}
        territories={draft.territories}
        dict={t}
      />
    </div>
  );
}
