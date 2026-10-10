import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getRouteForManagement } from "@/server/services/route-service";

import { enrichRouteForVisits, getAllTerritoryOptions, toEditorState } from "../enrich-route";
import { RouteDraftEditor } from "../route-draft-editor";
import { RouteLockedView } from "../route-locked-view";

export const dynamic = "force-dynamic";

type SingleRoutePageProps = { params: Promise<{ routeId: string }> };

// The dedicated page for building out or editing one specific route, opened
// from a row of the Add Routes list. Loaded through getRouteForManagement —
// the same authorization every action on the route uses — so a route the
// actor can't act on is "not found", never "exists but you can't see it."
// While still editable, renders the local-draft Save editor; once locked
// (its start date has begun), a read-only view with per-item cancel.
export default async function SingleRoutePage({ params }: SingleRoutePageProps) {
  const session = await requirePermission("routes:assign-team");
  const dict = await getServerDictionary();
  const t = dict.routesPage;
  const { routeId } = await params;

  // Just this one route, through the same authorization every action on it
  // uses — not the whole list — so "not found" means "not reachable".
  const [route, allTerritories] = await Promise.all([
    getRouteForManagement(routeId, session.user.id, session.user.roleName),
    getAllTerritoryOptions(),
  ]);
  if (!route) notFound();

  const enrichedRoute = await enrichRouteForVisits(route, allTerritories);
  const editorState = toEditorState(enrichedRoute.items);

  return (
    <div className="flex flex-col gap-6 p-6">
      <Button render={<Link href="/routes/add" />} variant="outline" size="sm" className="w-fit">
        <ArrowLeft aria-hidden />
        {t.backToPlanRoutes}
      </Button>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t.editRouteTitle}</h1>
        <p className="text-sm text-muted-foreground">{route.code}</p>
      </div>

      {enrichedRoute.editable ? (
        <RouteDraftEditor
          routeId={enrichedRoute.id}
          initialCenters={editorState.initialCenters}
          readOnlyItems={editorState.readOnlyItems}
          territories={enrichedRoute.territories}
          dict={t}
        />
      ) : (
        <RouteLockedView items={enrichedRoute.items} dict={t} />
      )}
    </div>
  );
}
