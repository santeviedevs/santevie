import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getCenter } from "@/server/services/center-service";

export const dynamic = "force-dynamic";

type CenterDetailPageProps = {
  params: Promise<{ id: string }>;
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

export default async function CenterDetailPage({ params }: CenterDetailPageProps) {
  await requirePermission("centers:manage");

  const { id } = await params;
  const [center, dict] = await Promise.all([getCenter(id), getServerDictionary()]);

  if (!center) {
    notFound();
  }

  const t = dict.centerDetailPage;
  const formDict = dict.centerForm;
  const notProvided = <span className="text-muted-foreground">{t.notProvided}</span>;

  const territoryPath = center.territory
    ? [
        center.territory.province.name,
        center.territory.ville?.name,
        center.territory.commune?.name,
        center.territory.quartier?.name,
      ]
        .filter(Boolean)
        .join(" › ")
    : "";

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{dict.viewCenterTitle(center.name)}</h1>
        <div className="flex gap-2">
          <Button render={<Link href="/admin/centers" />} variant="ghost">
            {t.backToList}
          </Button>
          <Button render={<Link href={`/admin/centers/${center.id}/edit`} />}>
            {t.editCenter}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{center.type.name}</Badge>
        <Badge variant={center.status === "ACTIVE" ? "default" : "secondary"}>
          {center.status === "ACTIVE"
            ? dict.centersPage.statusActive
            : dict.centersPage.statusInactive}
        </Badge>
        {!center.hasCoordinates ? (
          <Badge variant="destructive">{dict.centersPage.missingCoordinates}</Badge>
        ) : null}
      </div>

      <section className="flex flex-col gap-4 rounded-md border border-border p-4">
        <h2 className="text-sm font-medium">{t.detailsSectionLabel}</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label={formDict.code} value={center.code} />
          <Field label={formDict.name} value={center.name} />
          <Field label={t.responsiblePerson} value={center.responsiblePerson ?? notProvided} />
          <Field label={t.mobileNo} value={center.mobileNo ?? notProvided} />
          <Field label={t.address} value={center.address ?? notProvided} />
          <Field
            label={formDict.coordinatesLabel}
            value={
              center.hasCoordinates
                ? `${center.latitude?.toFixed(6)}, ${center.longitude?.toFixed(6)}`
                : notProvided
            }
          />
          <Field label={formDict.territorySectionLabel} value={territoryPath || notProvided} />
        </div>
      </section>

      {center.hospital ? (
        <section className="flex flex-col gap-4 rounded-md border border-border p-4">
          <h2 className="text-sm font-medium">{formDict.hospitalSectionLabel}</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={formDict.hospitalCategory}
              value={center.hospital.hospitalCategory ?? notProvided}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
