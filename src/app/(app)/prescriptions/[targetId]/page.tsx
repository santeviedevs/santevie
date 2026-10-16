import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import { getServerDictionary } from "@/lib/i18n/server";
import { hasPermission } from "@/server/auth/permissions";
import { requireAnyPermission } from "@/server/auth/require-permission";
import { getPrescriptionTargetDetail } from "@/server/services/prescription-service";

import { EditTargetForm } from "./edit-target-form";
import { RecordUpdateForm } from "./record-update-form";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ targetId: string }> };

// One target: its Target/Achieved/Remaining (derived live, never stored),
// the record-progress form (offered only to the target's own delegate —
// ownership, not scope, per the agreed authorization design), the edit-
// target form (manager-facing, prescriptions:manage-targets), the full
// update history ("visit-wise history" from the brief) and the target's
// own revision history if it's ever been edited.
export default async function PrescriptionTargetDetailPage({ params }: PageProps) {
  const session = await requireAnyPermission([
    "prescriptions:update-progress",
    "prescriptions:view-team",
  ]);
  const dict = await getServerDictionary();
  const t = dict.prescriptionsPage;
  const { targetId } = await params;

  const detail = await getPrescriptionTargetDetail(targetId, session);
  if (!detail) notFound();

  const { target, updates, revisions } = detail;
  const isOwner = session.user.id === target.user.id;
  const canManageTargets = hasPermission(session.user.permissions, "prescriptions:manage-targets");

  return (
    <div className="flex flex-col gap-6 p-6">
      <Button render={<Link href="/prescriptions" />} variant="outline" size="sm" className="w-fit">
        <ArrowLeft aria-hidden />
        {t.backToTargets}
      </Button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold">
            {target.product.name} — {target.contact.name}
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>
              {target.periodMonth}/{target.periodYear}
            </span>
            <span aria-hidden>·</span>
            <span>{target.user.name}</span>
          </p>
        </div>
      </header>

      <section className="flex flex-col gap-2" aria-labelledby="progress-heading">
        <h2 id="progress-heading" className="text-lg font-semibold">
          {t.progressHeading}
        </h2>
        <dl className="grid max-w-sm grid-cols-3 gap-3 text-sm">
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">{t.colTarget}</dt>
            <dd className="text-lg font-medium">{target.monthlyTarget}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">{t.colAchieved}</dt>
            <dd className="text-lg font-medium">{target.achieved}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">{t.colRemaining}</dt>
            <dd className="text-lg font-medium">{target.remaining}</dd>
          </div>
        </dl>
      </section>

      <hr className="border-border" />

      {isOwner ? (
        <section className="flex flex-col gap-3" aria-labelledby="record-update-heading">
          <h2 id="record-update-heading" className="text-lg font-semibold">
            {t.recordUpdateHeading}
          </h2>
          <RecordUpdateForm targetId={target.id} dict={t} />
        </section>
      ) : null}

      {canManageTargets ? (
        <>
          <hr className="border-border" />
          <EditTargetForm
            targetId={target.id}
            currentMonthlyTarget={target.monthlyTarget}
            dict={t}
          />
        </>
      ) : null}

      <hr className="border-border" />

      <section className="flex flex-col gap-2" aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-lg font-semibold">
          {t.historyHeading}
        </h2>
        {updates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.historyEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {updates.map((u) => (
              <li key={u.id} className="flex flex-col gap-0.5 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{u.cumulativeAchieved}</span>
                  <span className="text-muted-foreground">
                    {u.recordedBy.name} · {formatDate(u.recordedAt)}
                  </span>
                  {u.acknowledgedDecrease ? (
                    <Badge variant="outline">{t.acknowledgedDecreaseBadge}</Badge>
                  ) : null}
                </span>
                {u.feedback ? (
                  <span className="text-muted-foreground">
                    {t.feedbackLabel}: {u.feedback}
                  </span>
                ) : null}
                {u.challenges ? (
                  <span className="text-muted-foreground">
                    {t.challengesLabel}: {u.challenges}
                  </span>
                ) : null}
                {u.followUpDate ? (
                  <span className="text-muted-foreground">
                    {t.followUpDateLabel}: {formatDate(u.followUpDate)}
                  </span>
                ) : null}
                {u.correctionReason ? (
                  <span className="text-muted-foreground">
                    {t.correctionReasonLabel}: {u.correctionReason}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {revisions.length > 0 ? (
        <section className="flex flex-col gap-2" aria-labelledby="revisions-heading">
          <h2 id="revisions-heading" className="text-lg font-semibold">
            {t.revisionsHeading}
          </h2>
          <ul className="flex flex-col gap-1.5">
            {revisions.map((r) => (
              <li key={r.id} className="text-sm text-muted-foreground">
                {r.previousTarget} → {r.newTarget} · {r.changedBy.name} · {formatDate(r.changedAt)}
                {r.reason ? ` · ${r.reason}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
