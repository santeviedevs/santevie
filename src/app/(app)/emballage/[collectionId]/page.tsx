import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import { getServerDictionary } from "@/lib/i18n/server";
import { hasPermission } from "@/server/auth/permissions";
import { requireAnyPermission } from "@/server/auth/require-permission";
import { getEmballageCollectionDetail } from "@/server/services/emballage-service";

import { CorrectCollectionForm } from "./correct-collection-form";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ collectionId: string }> };

// One collection record: its context (centre, product, date, who logged
// it), the correction form (offered to the owning delegate while unlocked,
// or to a manager with emballage:correct-locked once a finalized EOM
// report has locked it), and the full correction history — see the §2.2
// controlled-correction design agreed with the client.
export default async function EmballageCollectionDetailPage({ params }: PageProps) {
  const session = await requireAnyPermission(["emballage:record-own", "emballage:view-team"]);
  const dict = await getServerDictionary();
  const t = dict.emballagePage;
  const { collectionId } = await params;

  const canViewTeam = hasPermission(session.user.permissions, "emballage:view-team");
  const canCorrectLocked = hasPermission(session.user.permissions, "emballage:correct-locked");
  const detail = await getEmballageCollectionDetail(
    collectionId,
    session,
    canViewTeam || canCorrectLocked,
  );
  if (!detail) notFound();

  const { collection, corrections } = detail;
  const isOwner = collection.user.id === session.user.id;
  const showCorrect = collection.locked ? canCorrectLocked : isOwner;

  return (
    <div className="flex flex-col gap-6 p-6">
      <Button render={<Link href="/emballage" />} variant="outline" size="sm" className="w-fit">
        <ArrowLeft aria-hidden />
        {t.myCollections}
      </Button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold">{collection.center.name}</h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>{collection.product.name}</span>
            <span aria-hidden>·</span>
            <span>{formatDate(collection.visitDate)}</span>
            <span aria-hidden>·</span>
            <span>
              {t.quantityLabel}: {collection.quantity}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            {t.colUser}: {collection.user.name}
          </p>
          {collection.remarks ? (
            <p className="text-sm text-muted-foreground">{collection.remarks}</p>
          ) : null}
        </div>
        {collection.locked ? <Badge variant="secondary">{t.lockedBadge}</Badge> : null}
      </header>

      <hr className="border-border" />

      {showCorrect ? (
        <CorrectCollectionForm
          collectionId={collection.id}
          currentQuantity={collection.quantity}
          dict={t}
        />
      ) : null}

      <hr className="border-border" />

      <section className="flex flex-col gap-2" aria-labelledby="correction-history-heading">
        <h2 id="correction-history-heading" className="text-lg font-semibold">
          {t.correctionHistory}
        </h2>
        {corrections.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.correctionHistoryEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {corrections.map((c) => (
              <li key={c.id} className="text-sm text-muted-foreground">
                {c.previousQuantity} → {c.newQuantity} · {c.correctedBy.name} ·{" "}
                {formatDate(c.correctedAt)}
                {c.reason ? ` · ${c.reason}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
