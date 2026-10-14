import { ArrowLeft, User } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getAssignmentDetail } from "@/server/services/activity-service";

import { assignmentStatusLabel, assignmentStatusVariant } from "../../activity-assignment-status";
import { CancelAssignmentButton } from "../cancel-assignment-button";
import { ReassignAssignmentForm } from "../reassign-assignment-form";

export const dynamic = "force-dynamic";

type AssignmentDetailPageProps = { params: Promise<{ assignmentId: string }> };

// The Manage page for one assignment, opened from a row of the Assignment
// table: the activity it belongs to, its assignee and status, and — for a
// manager, while it's still PLANNED — Reassign and Cancel. Both act on this
// one assignment alone; every other assignment on the same activity, if
// any, is untouched. Loaded through getAssignmentDetail, the same
// authorization every other action on it uses, so "not found" means "not
// reachable".
export default async function AssignmentDetailPage({ params }: AssignmentDetailPageProps) {
  const session = await requirePermission("activities:assign");
  const dict = await getServerDictionary();
  const t = dict.activitiesPage;
  const { assignmentId } = await params;

  const assignment = await getAssignmentDetail(assignmentId, session, true);
  if (!assignment) notFound();

  const canManage = assignment.status === "PLANNED";

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-4">
        <Button
          render={<Link href="/activities/assign" />}
          variant="outline"
          size="sm"
          className="w-fit"
        >
          <ArrowLeft aria-hidden />
          {t.backToAssignmentList}
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-2xl font-semibold">{assignment.activity.name}</h1>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <User className="size-4" aria-hidden />
                {assignment.user.name}
              </span>
              <span aria-hidden>·</span>
              <span>
                {assignment.activity.type.name} · {formatDate(assignment.scheduledDate)}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={assignmentStatusVariant(assignment.status)}>
              {assignmentStatusLabel(assignment.status, t)}
            </Badge>
            {canManage ? <CancelAssignmentButton assignmentId={assignment.id} dict={t} /> : null}
          </div>
        </div>
      </header>

      <hr className="border-border" />

      {assignment.activity.notes ? (
        <p className="text-sm text-muted-foreground">{assignment.activity.notes}</p>
      ) : null}

      {canManage ? (
        <>
          <hr className="border-border" />
          <ReassignAssignmentForm
            assignmentId={assignment.id}
            initialScheduledDate={assignment.scheduledDate.toISOString().slice(0, 10)}
            dict={t}
          />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t.noActionsHint}</p>
      )}
    </div>
  );
}
