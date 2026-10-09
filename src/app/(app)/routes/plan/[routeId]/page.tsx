import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getRoutesForContent } from "@/server/services/route-service";

import { enrichRouteForVisits, getAllTerritoryOptions } from "../enrich-route";
import { RouteDraftEditor } from "../route-draft-editor";
import { RouteLockedView } from "../route-locked-view";

export const dynamic = "force-dynamic";

type SingleRoutePageProps = { params: Promise<{ routeId: string }> };

// The dedicated page for building out or editing one specific route.
// Reuses getRoutesForContent rather than a separate single-route fetch, so
// the authorization boundary is identical: if this route isn't in the
// actor's editable list, it's treated as not found, never as "exists but
// you can't see it." While still editable, renders the local-draft Save
// editor; once locked (date started), a read-only view with per-item
// cancel.
export default async function SingleRoutePage({ params }: SingleRoutePageProps) {
  const session = await requirePermission("routes:assign-team");
  const dict = await getServerDictionary();
  const t = dict.routesPage;
  const { routeId } = await params;

  const [routes, allTerritories] = await Promise.all([
    getRoutesForContent(session.user.id, session.user.roleName),
    getAllTerritoryOptions(),
  ]);

  const route = routes.find((p) => p.id === routeId);
  if (!route) notFound();

  const enrichedRoute = await enrichRouteForVisits(route, allTerritories);

  return (
    <div className="flex flex-col gap-6 p-6">
      <Button render={<Link href="/routes/plan" />} variant="outline" size="sm" className="w-fit">
        {t.backToPlanRoutes}
      </Button>

      <h1 className="text-xl font-semibold">{t.planRoutesTitle}</h1>

      {enrichedRoute.editable ? (
        <RouteDraftEditor
          routeId={enrichedRoute.id}
          initialCenterIds={enrichedRoute.items
            .filter((item) => item.status === "PENDING")
            .map((item) => item.center.id)}
          readOnlyItems={enrichedRoute.items.filter(
            (item): item is typeof item & { status: "COMPLETED" | "CANCELLED" } =>
              item.status === "COMPLETED" || item.status === "CANCELLED",
          )}
          availableCenters={enrichedRoute.availableCenters}
          territories={enrichedRoute.territories}
          dict={t}
        />
      ) : (
        <RouteLockedView items={enrichedRoute.items} dict={t} />
      )}
    </div>
  );
}
