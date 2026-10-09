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
import { personFiltersSchema } from "@/lib/schemas/person";
import { requirePermission } from "@/server/auth/require-permission";
import { getPersonFilterOptions, listPersons } from "@/server/services/person-service";

import { PersonFilters } from "./person-filters";
import { PersonStatusButton } from "./person-status-button";

// Persons are organisation-wide and filtered per request; never let this be
// statically cached (execution plan, Section 4).
export const dynamic = "force-dynamic";

type PersonsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

export default async function PersonsPage({ searchParams }: PersonsPageProps) {
  await requirePermission("persons:manage");

  const params = await searchParams;
  const filters = personFiltersSchema.parse({
    q: firstValue(params.q),
    personTypeId: firstValue(params.personTypeId),
    specializationId: firstValue(params.specializationId),
    centerTypeId: firstValue(params.centerTypeId),
    territoryId: firstValue(params.territoryId),
    status: firstValue(params.status),
    page: firstValue(params.page),
    pageSize: firstValue(params.pageSize),
  });

  const [{ items: persons, total }, filterOptions, dict] = await Promise.all([
    listPersons(filters),
    getPersonFilterOptions(),
    getServerDictionary(),
  ]);
  const t = dict.persons;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.description}</p>
        </div>
        <Button render={<Link href="/admin/persons/new" />}>+ {t.addPerson}</Button>
      </div>

      <PersonFilters
        personTypes={filterOptions.personTypes}
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
              <TableHead>{t.columnPerson}</TableHead>
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
            {persons.map((person) => (
              <TableRow key={person.id}>
                <TableCell>{person.code}</TableCell>
                <TableCell>{person.name}</TableCell>
                <TableCell>{person.personType.name}</TableCell>
                <TableCell>{person.specialization.name}</TableCell>
                <TableCell>{person.mobile ?? "—"}</TableCell>
                <TableCell>{person.territory.label}</TableCell>
                <TableCell>
                  {person.centerCount} {t.centersLabel}
                </TableCell>
                <TableCell>
                  <Badge variant={person.status === "ACTIVE" ? "default" : "secondary"}>
                    {person.status === "ACTIVE" ? t.statusActive : t.statusInactive}
                  </Badge>
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  <Button
                    render={<Link href={`/admin/persons/${person.id}`} />}
                    variant="ghost"
                    size="sm"
                  >
                    {t.view}
                  </Button>
                  <Button
                    render={<Link href={`/admin/persons/${person.id}/edit`} />}
                    variant="outline"
                    size="sm"
                  >
                    {t.edit}
                  </Button>
                  <PersonStatusButton
                    personId={person.id}
                    status={person.status}
                    activateLabel={t.activate}
                    deactivateLabel={t.deactivate}
                    changedLabel={t.statusChanged}
                  />
                </TableCell>
              </TableRow>
            ))}
            {persons.length === 0 ? (
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
