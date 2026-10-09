import Link from "next/link";

import { PaginationControls } from "@/components/pagination-controls";
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
import { totalPages } from "@/lib/pagination";
import { contactFiltersSchema } from "@/lib/schemas/contact";
import { requirePermission } from "@/server/auth/require-permission";
import { getContactFilterOptions, listContacts } from "@/server/services/contact-service";

import { ContactFilters } from "./contact-filters";
import { ContactStatusButton } from "./contact-status-button";

// Contacts are organisation-wide and filtered per request; never let this be
// statically cached (execution plan, Section 4).
export const dynamic = "force-dynamic";

type ContactsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  await requirePermission("contacts:manage");

  const params = await searchParams;
  const filters = contactFiltersSchema.parse({
    q: firstValue(params.q),
    contactTypeId: firstValue(params.contactTypeId),
    specializationId: firstValue(params.specializationId),
    centerTypeId: firstValue(params.centerTypeId),
    territoryId: firstValue(params.territoryId),
    status: firstValue(params.status),
    page: firstValue(params.page),
    pageSize: firstValue(params.pageSize),
  });

  const [{ items: contacts, total }, filterOptions, dict] = await Promise.all([
    listContacts(filters),
    getContactFilterOptions(),
    getServerDictionary(),
  ]);
  const t = dict.contacts;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.description}</p>
        </div>
        <Button render={<Link href="/admin/contacts/new" />}>+ {t.addContact}</Button>
      </div>

      <ContactFilters
        contactTypes={filterOptions.contactTypes}
        specializations={filterOptions.specializations}
        centerTypes={filterOptions.centerTypes}
        territories={filterOptions.territories}
        filters={filters}
        dict={t}
        territoryDict={dict.territory}
      />

      <div className="min-w-0 rounded-md border border-border p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columnCode}</TableHead>
              <TableHead>{t.columnContact}</TableHead>
              <TableHead>{t.columnType}</TableHead>
              <TableHead>{t.columnSpecialization}</TableHead>
              <TableHead>{t.columnMobile}</TableHead>
              <TableHead>{t.columnTerritory}</TableHead>
              <TableHead>{t.columnCenters}</TableHead>
              <TableHead>{t.columnStatus}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell>{contact.code}</TableCell>
                <TableCell>{contact.name}</TableCell>
                <TableCell>{contact.contactType.name}</TableCell>
                <TableCell>{contact.specialization.name}</TableCell>
                <TableCell>{contact.mobile ?? "—"}</TableCell>
                <TableCell>{contact.territory.label}</TableCell>
                <TableCell>
                  {contact.centerCount} {t.centersLabel}
                </TableCell>
                <TableCell>
                  <Badge variant={contact.status === "ACTIVE" ? "default" : "secondary"}>
                    {contact.status === "ACTIVE" ? t.statusActive : t.statusInactive}
                  </Badge>
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  <Button
                    render={<Link href={`/admin/contacts/${contact.id}`} />}
                    variant="ghost"
                    size="sm"
                  >
                    {t.view}
                  </Button>
                  <Button
                    render={<Link href={`/admin/contacts/${contact.id}/edit`} />}
                    variant="outline"
                    size="sm"
                  >
                    {t.edit}
                  </Button>
                  <ContactStatusButton
                    contactId={contact.id}
                    status={contact.status}
                    activateLabel={t.activate}
                    deactivateLabel={t.deactivate}
                    changedLabel={t.statusChanged}
                  />
                </TableCell>
              </TableRow>
            ))}
            {contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  {t.noResults}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <PaginationControls
        page={filters.page}
        pageSize={filters.pageSize}
        total={total}
        previousLabel={dict.pagination.previous}
        nextLabel={dict.pagination.next}
        pageInfoLabel={dict.pagination.pageInfo(
          filters.page,
          totalPages(total, filters.pageSize),
          total,
        )}
      />
    </div>
  );
}
