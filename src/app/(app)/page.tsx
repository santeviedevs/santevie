import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getServerDictionary } from "@/lib/i18n/server";
import { auth } from "@/server/auth";
import { hasPermission } from "@/server/auth/permissions";
import { getMyFollowUps } from "@/server/services/follow-up-service";

import { FollowUpsWidget } from "./activities/follow-ups-widget";

// User-scoped — it shows the signed-in user's own follow-ups.
export const dynamic = "force-dynamic";

// There's no management dashboard yet (that's Sprint 5), so anyone who
// administers users still lands on admin/users as before. Everyone else
// lands here: for now, their pending and overdue follow-ups.
export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (hasPermission(session.user.permissions, "users:manage")) {
    redirect("/admin/users");
  }

  const dict = await getServerDictionary();
  const canRespond = hasPermission(session.user.permissions, "activities:respond-own");

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{dict.nav.home}</h1>

      {canRespond ? <HomeFollowUps userId={session.user.id} /> : null}
    </div>
  );
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
