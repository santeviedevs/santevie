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
import { listTerritories } from "@/server/services/territory-service";

import { TerritoryFilters } from "./territory-filters";

// Territory administration is inherently user-scoped by permission; never
// let this be statically cached, or one admin's list could be served to
// another (execution plan, section 4).
export const dynamic = "force-dynamic";

type TerritoriesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The status select's "Any status" option carries "" as its value, not an
// absent key. Normalize that to undefined here so it means "no filter"
// everywhere, matching what an omitted param already means — without this,
// status="" fails territoryFiltersSchema's z.enum(...).optional().
function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

export default async function TerritoriesPage({ searchParams }: TerritoriesPageProps) {
  await requirePermission("territories:manage");

  const params = await searchParams;
  const filters = territoryFiltersSchema.parse({
    q: firstValue(params.q),
    status: firstValue(params.status),
  });

  const [territories, dict] = await Promise.all([listTerritories(filters), getServerDictionary()]);
  const t = dict.territoriesPage;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t.title}</h1>
        <Button render={<Link href="/admin/territories/new" />}>{t.newTerritory}</Button>
      </div>

      <TerritoryFilters filters={filters} dict={dict.territoryFilters} />

      <div className="min-w-0 rounded-md border border-border p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columnCode}</TableHead>
              <TableHead>{t.columnName}</TableHead>
              <TableHead>{t.columnStatus}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {territories.map((territory) => (
              <TableRow key={territory.id}>
                <TableCell>{territory.code}</TableCell>
                <TableCell>{territory.name}</TableCell>
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
                <TableCell colSpan={4} className="text-center text-muted-foreground">
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
