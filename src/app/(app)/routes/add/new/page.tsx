import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";

import { enrichNewRouteDraft, getAllTerritoryOptions } from "../enrich-route";
import { RouteDraftEditor } from "../route-draft-editor";

export const dynamic = "force-dynamic";

// A brand-new route's editor — fully local until Save, which is the only
// point anything is actually persisted (see saveRouteContent). Nothing
// exists server-side yet, so there's no route to fetch: territory/center
// scoping is derived straight from the actor.
export default async function NewRoutePage() {
  const session = await requirePermission("routes:assign-team");
  const dict = await getServerDictionary();
  const t = dict.routesPage;

  const allTerritories = await getAllTerritoryOptions();
  const draft = await enrichNewRouteDraft(session.user.id, allTerritories);

  return (
    <div className="flex flex-col gap-6 p-6">
      <Button render={<Link href="/routes/add" />} variant="outline" size="sm" className="w-fit">
        <ArrowLeft aria-hidden />
        {t.backToPlanRoutes}
      </Button>

      <h1 className="text-xl font-semibold">{t.newRoutePageTitle}</h1>

      <RouteDraftEditor
        routeId={null}
        initialCenters={[]}
        readOnlyItems={[]}
        territories={draft.territories}
        dict={t}
      />
    </div>
  );
}
