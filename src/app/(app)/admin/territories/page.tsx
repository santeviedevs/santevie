import Link from "next/link";

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
import { territoryFiltersSchema } from "@/lib/schemas/territory";
import { requirePermission } from "@/server/auth/require-permission";
import {
  listActiveCommunes,
  listActiveProvinces,
  listActiveVilles,
} from "@/server/repositories/territory-repository";
import { listTerritoryEntries } from "@/server/services/territory-service";

import { TerritoryFilters } from "./territory-filters";

// Territory administration is inherently user-scoped by permission; never
// let this be statically cached, or one admin's list could be served to
// another (execution plan, section 4).
export const dynamic = "force-dynamic";

type TerritoriesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The filter form submits every field on every request, including ones
// left on their "Any ..." placeholder — those arrive as "" (the empty
// value that placeholder's SelectItem carries), not as an absent key.
// Normalize that to undefined here so it means "no filter" everywhere,
// matching what an omitted param already means. Without this, status=""
// fails territoryFiltersSchema's z.enum(...).optional().
function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

export default async function TerritoriesPage({ searchParams }: TerritoriesPageProps) {
  await requirePermission("territories:manage");

  const params = await searchParams;
  const filters = territoryFiltersSchema.parse({
    q: firstValue(params.q),
    provinceId: firstValue(params.provinceId),
    villeId: firstValue(params.villeId),
    communeId: firstValue(params.communeId),
    status: firstValue(params.status),
  });

  const [territories, provinces, villes, communes, dict] = await Promise.all([
    listTerritoryEntries(filters),
    listActiveProvinces(),
    listActiveVilles(),
    listActiveCommunes(),
    getServerDictionary(),
  ]);
  const t = dict.territoriesPage;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t.title}</h1>
        <Button render={<Link href="/admin/territories/new" />}>{t.newTerritory}</Button>
      </div>

      <TerritoryFilters
        provinces={provinces}
        villes={villes}
        communes={communes}
        filters={filters}
        dict={t}
        hierarchyDict={dict.territory}
      />

      <div className="min-w-0 rounded-md border border-border p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.provinceLabel}</TableHead>
              <TableHead>{t.villeLabel}</TableHead>
              <TableHead>{t.communeLabel}</TableHead>
              <TableHead>{t.quartierLabel}</TableHead>
              <TableHead>{t.columnStatus}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {territories.map((territory) => (
              <TableRow key={territory.id}>
                <TableCell>
                  {territory.level === "province"
                    ? territory.name
                    : (territory.province?.name ?? "—")}
                </TableCell>
                <TableCell>
                  {territory.level === "ville" ? territory.name : (territory.ville?.name ?? "—")}
                </TableCell>
                <TableCell>
                  {territory.level === "commune"
                    ? territory.name
                    : (territory.commune?.name ?? "—")}
                </TableCell>
                <TableCell>{territory.level === "quartier" ? territory.name : "—"}</TableCell>
                <TableCell>
                  <Badge variant={territory.status === "ACTIVE" ? "default" : "secondary"}>
                    {territory.status === "ACTIVE" ? t.statusActive : t.statusInactive}
                  </Badge>
                </TableCell>
                <TableCell className="flex justify-end">
                  <Button
                    render={<Link href={`/admin/territories/${territory.id}/edit`} />}
                    variant="outline"
                    size="sm"
                  >
                    {t.edit}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {territories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {t.noResults}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
