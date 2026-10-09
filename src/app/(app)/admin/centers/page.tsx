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
import { centerFiltersSchema } from "@/lib/schemas/center";
import { requirePermission } from "@/server/auth/require-permission";
import { listCenterTypes } from "@/server/repositories/center-repository";
import { listCenters } from "@/server/services/center-service";
import { listActiveTerritoryOptions } from "@/server/services/territory-service";

import { CenterFilters } from "./center-filters";

// Center master data is admin-facing but still filtered per request; never
// let this be statically cached (execution plan, Section 4).
export const dynamic = "force-dynamic";

type CentersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

export default async function CentersPage({ searchParams }: CentersPageProps) {
  await requirePermission("centers:manage");

  const params = await searchParams;
  const filters = centerFiltersSchema.parse({
    q: firstValue(params.q),
    typeId: firstValue(params.typeId),
    territoryId: firstValue(params.territoryId),
    status: firstValue(params.status),
    missingCoordinates: firstValue(params.missingCoordinates),
    page: firstValue(params.page),
    pageSize: firstValue(params.pageSize),
  });

  const [{ items: centers, total }, types, territories, dict] = await Promise.all([
    listCenters(filters),
    listCenterTypes(),
    listActiveTerritoryOptions(),
    getServerDictionary(),
  ]);
  const t = dict.centersPage;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t.title}</h1>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/admin/centers/import" />}>
            {t.importButton}
          </Button>
          <Button render={<Link href="/admin/centers/new" />}>{t.newCenter}</Button>
        </div>
      </div>

      <CenterFilters
        types={types}
        territories={territories}
        filters={filters}
        dict={dict.centerFilters}
        territoryDict={dict.territory}
      />

      <div className="min-w-0 rounded-md border border-border p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columnCode}</TableHead>
              <TableHead>{t.columnType}</TableHead>
              <TableHead>{t.columnName}</TableHead>
              <TableHead>{t.columnResponsiblePerson}</TableHead>
              <TableHead>{t.columnContact}</TableHead>
              <TableHead>{t.columnTerritory}</TableHead>
              <TableHead>{t.columnCoordinates}</TableHead>
              <TableHead>{t.columnStatus}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {centers.map((center) => (
              <TableRow key={center.id}>
                <TableCell>{center.code}</TableCell>
                <TableCell>{center.type.name}</TableCell>
                <TableCell>{center.name}</TableCell>
                <TableCell>{center.responsiblePerson ?? "—"}</TableCell>
                <TableCell>{center.contact ?? "—"}</TableCell>
                <TableCell>{center.territory?.code ?? "—"}</TableCell>
                <TableCell>
                  {center.hasCoordinates ? (
                    `${center.latitude?.toFixed(4)}, ${center.longitude?.toFixed(4)}`
                  ) : (
                    <Badge variant="destructive">{t.missingCoordinates}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={center.status === "ACTIVE" ? "default" : "secondary"}>
                    {center.status === "ACTIVE" ? t.statusActive : t.statusInactive}
                  </Badge>
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  <Button
                    render={<Link href={`/admin/centers/${center.id}`} />}
                    variant="ghost"
                    size="sm"
                  >
                    {t.view}
                  </Button>
                  <Button
                    render={<Link href={`/admin/centers/${center.id}/edit`} />}
                    variant="outline"
                    size="sm"
                  >
                    {t.edit}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {centers.length === 0 ? (
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
