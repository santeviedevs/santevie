import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import { getServerDictionary } from "@/lib/i18n/server";
import { hasPermission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";
import { getActivityDetail } from "@/server/services/activity-service";

import { assignmentStatusLabel, assignmentStatusVariant } from "../../activity-assignment-status";

export const dynamic = "force-dynamic";

type MyActivityDetailPageProps = { params: Promise<{ activityId: string }> };

// The read-only view of one activity, opened from a row of My Activities —
// always read-only here, even for a manager viewing their own assignment:
// editing the activity's own fields happens through the main Activity List,
// and reassigning or cancelling an assignment through the Assignment
// screen, neither of which this self-service screen offers. Loaded through
// getActivityDetail, the same authorization every other action on the
// activity uses, so "not found" means "not reachable".
export default async function MyActivityDetailPage({ params }: MyActivityDetailPageProps) {
  const session = await requirePermission("activities:respond-own");
  const dict = await getServerDictionary();
  const t = dict.activitiesPage;
  const { activityId } = await params;

  const canAssign = hasPermission(session.user.permissions, "activities:assign");
  const activity = await getActivityDetail(activityId, session, canAssign);
  if (!activity) notFound();

  return (
    <div className="flex flex-col gap-6 p-6">
      <Button render={<Link href="/activities/my" />} variant="outline" size="sm" className="w-fit">
        <ArrowLeft aria-hidden />
        {t.myActivitiesTitle}
      </Button>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{activity.name}</h1>
      </div>

      <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t.nameLabel}</dt>
        <dd>{activity.name}</dd>
        <dt className="text-muted-foreground">{t.typeLabel}</dt>
        <dd>{activity.type.name}</dd>
        {activity.center ? (
          <>
            <dt className="text-muted-foreground">{t.targetCenter}</dt>
            <dd>
              {activity.center.name} ({activity.center.code})
            </dd>
          </>
        ) : null}
        {activity.territory ? (
          <>
            <dt className="text-muted-foreground">{t.targetTerritory}</dt>
            <dd>{activity.territory.code}</dd>
          </>
        ) : null}
        {activity.notes ? (
          <>
            <dt className="text-muted-foreground">{t.notesLabel}</dt>
            <dd>{activity.notes}</dd>
          </>
        ) : null}
      </dl>

      <hr className="border-border" />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t.assignmentsHeading}</h2>

        {activity.assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noAssignments}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {activity.assignments.map((assignment) => (
              <li
                key={assignment.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3"
              >
                <span className="font-medium">{assignment.user.name}</span>
                <Badge variant={assignmentStatusVariant(assignment.status)}>
                  {assignmentStatusLabel(assignment.status, t)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {formatDate(assignment.scheduledDate)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
