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
import { clientFiltersSchema } from "@/lib/schemas/client";
import { requirePermission } from "@/server/auth/require-permission";
import { listClientTypes } from "@/server/repositories/client-repository";
import {
  listActiveCommunes,
  listActiveProvinces,
  listActiveQuartiers,
  listActiveVilles,
} from "@/server/repositories/territory-repository";
import type { ClientSummary } from "@/server/services/client-service";
import { listClients } from "@/server/services/client-service";

import { ClientFilters } from "./client-filters";

// Client master data is admin-facing but still filtered per request; never
// let this be statically cached (execution plan, Section 4).
export const dynamic = "force-dynamic";

type ClientsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

function territoryLabel(client: ClientSummary): string {
  return (
    client.quartier?.name ??
    client.commune?.name ??
    client.ville?.name ??
    client.province?.name ??
    "—"
  );
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  await requirePermission("clients:manage");

  const params = await searchParams;
  const filters = clientFiltersSchema.parse({
    q: firstValue(params.q),
    typeId: firstValue(params.typeId),
    provinceId: firstValue(params.provinceId),
    villeId: firstValue(params.villeId),
    communeId: firstValue(params.communeId),
    quartierId: firstValue(params.quartierId),
    status: firstValue(params.status),
    missingCoordinates: firstValue(params.missingCoordinates),
  });

  const [clients, types, provinces, villes, communes, quartiers, dict] = await Promise.all([
    listClients(filters),
    listClientTypes(),
    listActiveProvinces(),
    listActiveVilles(),
    listActiveCommunes(),
    listActiveQuartiers(),
    getServerDictionary(),
  ]);
  const t = dict.clientsPage;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t.title}</h1>
        <Button render={<Link href="/admin/clients/new" />}>{t.newClient}</Button>
      </div>

      <ClientFilters
        types={types}
        provinces={provinces}
        villes={villes}
        communes={communes}
        quartiers={quartiers}
        filters={filters}
        dict={dict.clientFilters}
        territoryDict={dict.territory}
      />

      <div className="min-w-0 rounded-md border border-border p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columnCode}</TableHead>
              <TableHead>{t.columnName}</TableHead>
              <TableHead>{t.columnType}</TableHead>
              <TableHead>{t.columnTerritory}</TableHead>
              <TableHead>{t.columnCoordinates}</TableHead>
              <TableHead>{t.columnStatus}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>{client.code}</TableCell>
                <TableCell>{client.name}</TableCell>
                <TableCell>{client.type.name}</TableCell>
                <TableCell>{territoryLabel(client)}</TableCell>
                <TableCell>
                  {client.hasCoordinates ? (
                    `${client.latitude?.toFixed(4)}, ${client.longitude?.toFixed(4)}`
                  ) : (
                    <Badge variant="destructive">{t.missingCoordinates}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={client.status === "ACTIVE" ? "default" : "secondary"}>
                    {client.status === "ACTIVE" ? t.statusActive : t.statusInactive}
                  </Badge>
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  <Button
                    render={<Link href={`/admin/clients/${client.id}`} />}
                    variant="ghost"
                    size="sm"
                  >
                    {t.view}
                  </Button>
                  <Button
                    render={<Link href={`/admin/clients/${client.id}/edit`} />}
                    variant="outline"
                    size="sm"
                  >
                    {t.edit}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
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
