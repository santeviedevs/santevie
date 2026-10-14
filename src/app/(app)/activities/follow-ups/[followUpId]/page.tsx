import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import { getServerDictionary } from "@/lib/i18n/server";
import { hasPermission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";
import { getFollowUpDetail } from "@/server/services/follow-up-service";

import { CompleteFollowUpForm } from "./complete-follow-up-form";
import { ReassignFollowUpForm } from "./reassign-follow-up-form";

export const dynamic = "force-dynamic";

type FollowUpDetailPageProps = {
  params: Promise<{ followUpId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// One follow-up: its context (activity, participant if this is a
// per-participant link, due date), completion (offered to the current
// owner while PENDING), reassignment (offered to a manager whose scope
// reaches the current owner), and the full reassignment history. Loaded
// through getFollowUpDetail, the same authorization every action on it
// uses — "not found" means "not reachable". `?from=team` (set by the team
// widget's links) sends Back to the team list instead of the default My
// Follow-Ups, so the viewer returns to wherever they actually came from.
export default async function FollowUpDetailPage({
  params,
  searchParams,
}: FollowUpDetailPageProps) {
  const session = await requirePermission("activities:respond-own");
  const dict = await getServerDictionary();
  const t = dict.activitiesPage;
  const { followUpId } = await params;
  const { from } = await searchParams;

  const canAssign = hasPermission(session.user.permissions, "activities:assign");
  const detail = await getFollowUpDetail(followUpId, session, canAssign);
  if (!detail) notFound();

  const { followUp, reassignments } = detail;
  const isOwner = followUp.ownerId === session.user.id;
  const isPending = followUp.status === "PENDING";
  const showComplete = isPending && isOwner;
  const showReassign = isPending && canAssign;

  const backHref = from === "team" ? "/activities/follow-ups/team" : "/activities/follow-ups";
  const backLabel = from === "team" ? t.backToTeamFollowUps : t.backToFollowUps;

  return (
    <div className="flex flex-col gap-6 p-6">
      <Button render={<Link href={backHref} />} variant="outline" size="sm" className="w-fit">
        <ArrowLeft aria-hidden />
        {backLabel}
      </Button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold">{followUp.activity.name}</h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>{followUp.activity.type.name}</span>
            <span aria-hidden>·</span>
            <span>
              {t.dueDateLabel}: {formatDate(followUp.dueDate)}
            </span>
            {followUp.participant ? (
              <>
                <span aria-hidden>·</span>
                <span>
                  {t.participantLabel}: {followUp.participant.name}
                </span>
              </>
            ) : null}
          </p>
          <p className="text-sm text-muted-foreground">
            {t.ownerLabel}: {followUp.ownerName}
          </p>
        </div>
        <Badge variant={followUp.status === "DONE" ? "secondary" : "default"}>
          {followUp.status === "DONE" ? t.followUpStatusDone : t.followUpStatusPending}
        </Badge>
      </header>

      <hr className="border-border" />

      {showComplete ? <CompleteFollowUpForm followUpId={followUp.id} dict={t} /> : null}

      {showComplete && showReassign ? <hr className="border-border" /> : null}

      {showReassign ? <ReassignFollowUpForm followUpId={followUp.id} dict={t} /> : null}

      {!showComplete && !showReassign ? (
        <p className="text-sm text-muted-foreground">{t.noActionsHint}</p>
      ) : null}

      <hr className="border-border" />

      <section className="flex flex-col gap-2" aria-labelledby="reassignment-history-heading">
        <h2 id="reassignment-history-heading" className="text-lg font-semibold">
          {t.reassignmentHistoryHeading}
        </h2>
        {reassignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noReassignments}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {reassignments.map((r) => (
              <li key={r.id} className="text-sm text-muted-foreground">
                {r.previousOwner.name} → {r.newOwner.name} · {r.reassignedBy.name} ·{" "}
                {formatDate(r.reassignedAt)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
