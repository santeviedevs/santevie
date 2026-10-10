import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getServerDictionary } from "@/lib/i18n/server";
import { auth } from "@/server/auth";
import { hasPermission } from "@/server/auth/permissions";
import { getMyFollowUps } from "@/server/services/follow-up-service";
import { getMyRoutesForHome } from "@/server/services/route-service";

import { FollowUpsWidget } from "./activities/follow-ups-widget";
import { MyRoutesSection } from "./my-routes-section";

// User-scoped — it shows the signed-in user's own routes and follow-ups.
export const dynamic = "force-dynamic";

// Everyone lands here, Admins included (they reach Users from the nav).
// There's no management dashboard yet (that's Sprint 5), so for now Home is
// the signed-in user's own work: their assigned routes for this week and
// next, then their pending and overdue follow-ups. Own data only, for every
// role — no team view.
export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const dict = await getServerDictionary();
  const canRespond = hasPermission(session.user.permissions, "activities:respond-own");
  const canSeeRoutes = hasPermission(session.user.permissions, "visits:respond-own");

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{dict.nav.home}</h1>

      {canSeeRoutes ? <HomeRoutes userId={session.user.id} /> : null}
      {canRespond ? <HomeFollowUps userId={session.user.id} /> : null}
    </div>
  );
}

async function HomeRoutes({ userId }: { userId: string }) {
  const dict = await getServerDictionary();
  const routes = await getMyRoutesForHome(userId);

  return <MyRoutesSection routes={routes} dict={dict.routesPage} />;
}

async function HomeFollowUps({ userId }: { userId: string }) {
  const dict = await getServerDictionary();
  const t = dict.activitiesPage;
  const { pending, overdue } = await getMyFollowUps(userId);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{t.followUpsHeading}</h2>
        <Button render={<Link href="/activities/follow-ups" />} variant="outline" size="sm">
          {t.myFollowUps}
        </Button>
      </div>
      <FollowUpsWidget pending={pending} overdue={overdue} dict={t} />
    </div>
  );
}
