import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getClient } from "@/server/services/client-service";

export const dynamic = "force-dynamic";

type ClientDetailPageProps = {
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

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  await requirePermission("clients:manage");

  const { id } = await params;
  const [client, dict] = await Promise.all([getClient(id), getServerDictionary()]);

  if (!client) {
    notFound();
  }

  const t = dict.clientDetailPage;
  const formDict = dict.clientForm;
  const notProvided = <span className="text-muted-foreground">{t.notProvided}</span>;

  const territoryPath = client.territory
    ? [
        client.territory.province.name,
        client.territory.ville?.name,
        client.territory.commune?.name,
        client.territory.quartier?.name,
      ]
        .filter(Boolean)
        .join(" › ")
    : "";

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{dict.viewClientTitle(client.name)}</h1>
        <div className="flex gap-2">
          <Button render={<Link href="/admin/clients" />} variant="ghost">
            {t.backToList}
          </Button>
          <Button render={<Link href={`/admin/clients/${client.id}/edit`} />}>
            {t.editClient}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{client.type.name}</Badge>
        <Badge variant={client.status === "ACTIVE" ? "default" : "secondary"}>
          {client.status === "ACTIVE"
            ? dict.clientsPage.statusActive
            : dict.clientsPage.statusInactive}
        </Badge>
        {!client.hasCoordinates ? (
          <Badge variant="destructive">{dict.clientsPage.missingCoordinates}</Badge>
        ) : null}
      </div>

      <section className="flex flex-col gap-4 rounded-md border border-border p-4">
        <h2 className="text-sm font-medium">{t.detailsSectionLabel}</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label={formDict.code} value={client.code} />
          <Field label={formDict.name} value={client.name} />
          <Field label={t.contact} value={client.contact ?? notProvided} />
          <Field label={t.address} value={client.address ?? notProvided} />
          <Field
            label={formDict.coordinatesLabel}
            value={
              client.hasCoordinates
                ? `${client.latitude?.toFixed(6)}, ${client.longitude?.toFixed(6)}`
                : notProvided
            }
          />
          <Field label={formDict.territorySectionLabel} value={territoryPath || notProvided} />
        </div>
      </section>

      {client.doctor ? (
        <section className="flex flex-col gap-4 rounded-md border border-border p-4">
          <h2 className="text-sm font-medium">{formDict.doctorSectionLabel}</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label={formDict.doctorType} value={client.doctor.doctorType ?? notProvided} />
            <Field label={formDict.gender} value={client.doctor.gender ?? notProvided} />
            <Field label={formDict.department} value={client.doctor.department ?? notProvided} />
            <Field label={formDict.mobileNo} value={client.doctor.mobileNo ?? notProvided} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">{formDict.associatedHospitals}</span>
            {client.doctor.hospitals.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {client.doctor.hospitals.map((hospital) => (
                  <li key={hospital.id} className="text-sm">
                    {hospital.name}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({t.hospitalCode}: {hospital.code})
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-sm text-muted-foreground">{formDict.noHospitals}</span>
            )}
          </div>
        </section>
      ) : null}

      {client.hospital ? (
        <section className="flex flex-col gap-4 rounded-md border border-border p-4">
          <h2 className="text-sm font-medium">{formDict.hospitalSectionLabel}</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={formDict.hospitalCategory}
              value={client.hospital.hospitalCategory ?? notProvided}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
