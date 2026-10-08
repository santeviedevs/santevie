import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getPlansForAssignment, listAssignableUsers } from "@/server/services/plan-service";

import { AssignDetail } from "../assign-detail";

export const dynamic = "force-dynamic";

type AssignDetailPageProps = { params: Promise<{ planId: string }> };

// The dedicated page for assigning/reassigning one specific plan, or
// cancelling its assignment — the only place on the Assignment screen that
// actually writes. Reuses getPlansForAssignment rather than a separate
// single-plan fetch, so the authorization boundary matches the list
// exactly: not found here means not reachable, not "exists but hidden."
export default async function AssignDetailPage({ params }: AssignDetailPageProps) {
  const session = await requirePermission("plans:assign-team");
  const dict = await getServerDictionary();
  const t = dict.plansPage;
  const { planId } = await params;

  const [plans, assignableUsers] = await Promise.all([
    getPlansForAssignment(session.user.id, session.user.roleName),
    listAssignableUsers(session.user.id),
  ]);

  const plan = plans.find((p) => p.id === planId);
  if (!plan) notFound();

  return (
    <div className="flex flex-col gap-6 p-6">
      <Button render={<Link href="/plans/assign" />} variant="outline" size="sm" className="w-fit">
        {t.backToAssignment}
      </Button>

      <h1 className="text-xl font-semibold">
        {plan.visitorName ?? t.unassignedLabel}
        {plan.date ? ` — ${formatDate(plan.date)}` : ""}
      </h1>

      <AssignDetail
        planId={plan.id}
        visitorName={plan.visitorName}
        date={plan.date ? plan.date.toISOString() : null}
        items={plan.items}
        users={assignableUsers.map((u) => ({
          id: u.id,
          label: u.id === session.user.id ? t.myselfOption : u.name,
        }))}
        dict={t}
      />
    </div>
  );
}
