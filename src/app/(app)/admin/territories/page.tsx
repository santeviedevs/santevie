import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { territoryFiltersSchema } from "@/lib/schemas/territory";
import { requirePermission } from "@/server/auth/require-permission";
import { listTerritories } from "@/server/services/territory-service";

import { StatusButton } from "./status-button";

// Territory administration is inherently user-scoped by permission; never
// let this be statically cached, or one admin's list could be served to
// another (execution plan, section 4).
export const dynamic = "force-dynamic";

type TerritoriesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TerritoriesPage({ searchParams }: TerritoriesPageProps) {
  await requirePermission("territories:manage");

  const params = await searchParams;
  const filters = territoryFiltersSchema.parse({
    q: firstValue(params.q),
    status: firstValue(params.status),
  });

  const territories = await listTerritories(filters);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Territories</h1>
        <Button render={<Link href="/admin/territories/new" />}>New territory</Button>
      </div>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="text-xs text-muted-foreground">
            Search
          </label>
          <Input id="q" name="q" defaultValue={filters.q} placeholder="Name or code" />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="text-xs text-muted-foreground">
            Status
          </label>
          <Select
            name="status"
            items={[
              { value: "", label: "Any status" },
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
            defaultValue={filters.status}
          >
            <SelectTrigger id="status" className="w-36">
              <SelectValue placeholder="Any status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" variant="secondary">
          Apply filters
        </Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
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
                  {territory.status}
                </Badge>
              </TableCell>
              <TableCell className="flex justify-end gap-2">
                <Button
                  render={<Link href={`/admin/territories/${territory.id}/edit`} />}
                  variant="outline"
                  size="sm"
                >
                  Edit
                </Button>
                <StatusButton
                  territoryId={territory.id}
                  territoryName={territory.name}
                  status={territory.status}
                />
              </TableCell>
            </TableRow>
          ))}
          {territories.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No territories match these filters.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
