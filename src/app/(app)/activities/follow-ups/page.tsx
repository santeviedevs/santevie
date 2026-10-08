import { getServerDictionary } from "@/lib/i18n/server";
import { hasPermission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";
import { getMyFollowUps } from "@/server/services/follow-up-service";

import { FollowUpsWidget } from "../follow-ups-widget";
import { FollowUpTabs } from "./follow-up-tabs";

export const dynamic = "force-dynamic";

export default async function MyFollowUpsPage() {
  const session = await requirePermission("activities:respond-own");
  const dict = await getServerDictionary();
  const t = dict.activitiesPage;

  const { pending, overdue } = await getMyFollowUps(session.user.id);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{t.myFollowUps}</h1>
      <FollowUpTabs
        active="mine"
        canViewTeam={hasPermission(session.user.permissions, "activities:view-team")}
        dict={t}
      />
      <FollowUpsWidget pending={pending} overdue={overdue} dict={t} />
    </div>
  );
}
