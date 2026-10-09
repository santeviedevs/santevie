import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getPerson } from "@/server/services/person-service";

import { PersonStatusButton } from "../person-status-button";

export const dynamic = "force-dynamic";

type PersonDetailPageProps = {
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

export default async function PersonDetailPage({ params }: PersonDetailPageProps) {
  await requirePermission("persons:manage");

  const { id } = await params;
  const [person, dict] = await Promise.all([getPerson(id), getServerDictionary()]);
  if (!person) notFound();

  const t = dict.persons;
  const notProvided = <span className="text-muted-foreground">{t.notProvided}</span>;
  const genderLabel =
    person.gender === "MALE"
      ? t.genderMale
      : person.gender === "FEMALE"
        ? t.genderFemale
        : person.gender === "OTHER"
          ? t.genderOther
          : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{person.name}</h1>
          <Badge variant="outline">{person.code}</Badge>
          <Badge variant={person.status === "ACTIVE" ? "default" : "secondary"}>
            {person.status === "ACTIVE" ? t.statusActive : t.statusInactive}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button render={<Link href="/admin/persons" />} variant="ghost">
            {t.backToList}
          </Button>
          <PersonStatusButton
            personId={person.id}
            status={person.status}
            activateLabel={t.activate}
            deactivateLabel={t.deactivate}
            changedLabel={t.statusChanged}
          />
          <Button render={<Link href={`/admin/persons/${person.id}/edit`} />}>
            {t.editPerson}
          </Button>
        </div>
      </div>

      <section className="flex flex-col gap-4 rounded-md border border-border p-4">
        <h2 className="text-sm font-medium">{t.basicSection}</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t.codeLabel} value={person.code} />
          <Field label={t.name} value={person.name} />
          <Field label={t.personType} value={person.personType.name} />
          <Field label={t.gender} value={genderLabel ?? notProvided} />
          <Field label={t.mobile} value={person.mobile ?? notProvided} />
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-md border border-border p-4">
        <h2 className="text-sm font-medium">{t.professionalSection}</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t.specialization} value={person.specialization.name} />
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-md border border-border p-4">
        <h2 className="text-sm font-medium">{t.territorySection}</h2>
        <Field label={t.territory} value={person.territory.label} />
      </section>

      <section className="flex flex-col gap-3 rounded-md border border-border p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">{t.centersSection}</h2>
          <p className="text-xs text-muted-foreground">{t.centerRelationNote}</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.center}</TableHead>
              <TableHead>{t.centerType}</TableHead>
              <TableHead>{t.roleAtCenter}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {person.centers.map((center) => (
              <TableRow key={center.clientId}>
                <TableCell>
                  {center.name} ({center.code})
                </TableCell>
                <TableCell>{center.typeName}</TableCell>
                <TableCell>{center.roleName}</TableCell>
              </TableRow>
            ))}
            {person.centers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  {t.noCenters}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
