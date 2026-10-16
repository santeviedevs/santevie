import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getServerDictionary } from "@/lib/i18n/server";
import { todayInKinshasa } from "@/lib/week";
import { auth } from "@/server/auth";
import { hasPermission } from "@/server/auth/permissions";
import { getMyFollowUps } from "@/server/services/follow-up-service";
import { getMyPrescriptionFollowUps } from "@/server/services/prescription-service";
import { getMyRoutesForHome } from "@/server/services/route-service";

import { type HomeFollowUpItem, HomeFollowUpsList } from "./home-follow-ups";
import { PlannedVisitsSection } from "./planned-visits-section";

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
  const canRecordPrescriptions = hasPermission(
    session.user.permissions,
    "prescriptions:update-progress",
  );
  const canSeeRoutes = hasPermission(session.user.permissions, "visits:respond-own");

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{dict.nav.home}</h1>

      {canSeeRoutes ? <HomeRoutes userId={session.user.id} /> : null}
      {canRespond || canRecordPrescriptions ? (
        <HomeFollowUps
          userId={session.user.id}
          canRespond={canRespond}
          canRecordPrescriptions={canRecordPrescriptions}
        />
      ) : null}
    </div>
  );
}

async function HomeRoutes({ userId }: { userId: string }) {
  const dict = await getServerDictionary();
  const routes = await getMyRoutesForHome(userId);

  return <PlannedVisitsSection routes={routes} dict={dict.routesPage} />;
}

// Merges activity follow-ups (FollowUp rows) and prescription follow-ups
// (derived live from PrescriptionUpdate.followUpDate — never stored as a
// FollowUp, see home-follow-ups.tsx) into one list, sorted by due date.
// Each source is only fetched when the viewer holds its permission, so a
// role with just one of the two still gets a correct, non-empty section.
async function HomeFollowUps({
  userId,
  canRespond,
  canRecordPrescriptions,
}: {
  userId: string;
  canRespond: boolean;
  canRecordPrescriptions: boolean;
}) {
  const dict = await getServerDictionary();
  const t = dict.activitiesPage;

  const [activityFollowUps, prescriptionFollowUps] = await Promise.all([
    canRespond ? getMyFollowUps(userId).then((r) => r.pending) : Promise.resolve([]),
    canRecordPrescriptions ? getMyPrescriptionFollowUps(userId) : Promise.resolve([]),
  ]);

  const items: HomeFollowUpItem[] = [
    ...activityFollowUps.map((f) => ({ kind: "activity" as const, ...f })),
    ...prescriptionFollowUps.map((f) => ({ kind: "prescription" as const, ...f })),
  ].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-medium">{t.homeFollowUpsHeading}</h2>
          <p className="text-xs text-muted-foreground">{t.homeFollowUpsHelp}</p>
        </div>
        {canRespond ? (
          <Button render={<Link href="/activities/follow-ups" />} variant="outline" size="sm">
            {t.myFollowUps}
          </Button>
        ) : null}
      </div>
      <HomeFollowUpsList pending={items} today={todayInKinshasa()} dict={t} />
    </div>
  );
}
