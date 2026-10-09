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
import { getContact } from "@/server/services/contact-service";

import { ContactStatusButton } from "../contact-status-button";

export const dynamic = "force-dynamic";

type ContactDetailPageProps = {
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

export default async function ContactDetailPage({ params }: ContactDetailPageProps) {
  await requirePermission("contacts:manage");

  const { id } = await params;
  const [contact, dict] = await Promise.all([getContact(id), getServerDictionary()]);
  if (!contact) notFound();

  const t = dict.contacts;
  const notProvided = <span className="text-muted-foreground">{t.notProvided}</span>;
  const genderLabel =
    contact.gender === "MALE"
      ? t.genderMale
      : contact.gender === "FEMALE"
        ? t.genderFemale
        : contact.gender === "OTHER"
          ? t.genderOther
          : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{contact.name}</h1>
          <Badge variant="outline">{contact.code}</Badge>
          <Badge variant={contact.status === "ACTIVE" ? "default" : "secondary"}>
            {contact.status === "ACTIVE" ? t.statusActive : t.statusInactive}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button render={<Link href="/admin/contacts" />} variant="ghost">
            {t.backToList}
          </Button>
          <ContactStatusButton
            contactId={contact.id}
            status={contact.status}
            activateLabel={t.activate}
            deactivateLabel={t.deactivate}
            changedLabel={t.statusChanged}
          />
          <Button render={<Link href={`/admin/contacts/${contact.id}/edit`} />}>
            {t.editContact}
          </Button>
        </div>
      </div>

      <section className="flex flex-col gap-4 rounded-md border border-border p-4">
        <h2 className="text-sm font-medium">{t.basicSection}</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t.codeLabel} value={contact.code} />
          <Field label={t.name} value={contact.name} />
          <Field label={t.contactType} value={contact.contactType.name} />
          <Field label={t.gender} value={genderLabel ?? notProvided} />
          <Field label={t.mobile} value={contact.mobile ?? notProvided} />
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-md border border-border p-4">
        <h2 className="text-sm font-medium">{t.professionalSection}</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t.specialization} value={contact.specialization.name} />
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-md border border-border p-4">
        <h2 className="text-sm font-medium">{t.territorySection}</h2>
        <Field label={t.territory} value={contact.territory.label} />
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
            {contact.centers.map((center) => (
              <TableRow key={center.centerId}>
                <TableCell>
                  {center.name} ({center.code})
                </TableCell>
                <TableCell>{center.typeName}</TableCell>
                <TableCell>{center.roleName}</TableCell>
              </TableRow>
            ))}
            {contact.centers.length === 0 ? (
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
