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
import { userFiltersSchema } from "@/lib/schemas/user";
import { requirePermission } from "@/server/auth/require-permission";
import { listRoleOptions, listTerritoryOptions } from "@/server/repositories/user-repository";
import { getUserScope } from "@/server/scope";
import { listUsers } from "@/server/services/user-service";

import { DeactivateButton } from "./deactivate-button";

// User administration is inherently user-scoped; never let this be
// statically cached, or one admin's list could be served to another.
export const dynamic = "force-dynamic";

type UsersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The filter form submits every field on every request, including ones
// left on their "Any ..." placeholder — those arrive as "" (the empty
// value that placeholder's SelectItem carries), not as an absent key.
// Normalize that to undefined here so it means "no filter" everywhere,
// matching what an omitted param already means. Without this, status=""
// fails userFiltersSchema's z.enum(...).optional() (which accepts
// undefined but not ""), throwing on every submission that leaves Status
// on "Any status".
function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const session = await requirePermission("users:manage");

  const params = await searchParams;
  const filters = userFiltersSchema.parse({
    q: firstValue(params.q),
    roleId: firstValue(params.roleId),
    territoryId: firstValue(params.territoryId),
    status: firstValue(params.status),
  });

  const hasActiveFilters = Boolean(
    filters.q || filters.roleId || filters.territoryId || filters.status,
  );

  const scope = await getUserScope(session);
  const [users, roles, territories] = await Promise.all([
    listUsers(filters, scope),
    listRoleOptions(),
    listTerritoryOptions(),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Users</h1>
        <Button render={<Link href="/admin/users/new" />}>New user</Button>
      </div>

      {/*
        Keyed by the current filter state: the fields below are uncontrolled
        (defaultValue-based). Client-side navigation from "Apply filters" or
        "Clear filters" re-renders this Server Component with new
        searchParams but doesn't remount the form, so an uncontrolled Select
        would otherwise keep showing the previous selection — Base UI warns
        about exactly this ("changing the default value state of an
        uncontrolled Select after being initialized"). The key forces a
        fresh mount whenever the URL's filters actually change.
      */}
      <form
        key={JSON.stringify(filters)}
        className="flex flex-wrap items-end gap-3"
        method="get"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="text-xs text-muted-foreground">
            Search
          </label>
          <Input id="q" name="q" defaultValue={filters.q} placeholder="Name, email or code" />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="roleId" className="text-xs text-muted-foreground">
            Role
          </label>
          <Select
            name="roleId"
            items={[
              { value: "", label: "Any role" },
              ...roles.map((role) => ({ value: role.id, label: role.name })),
            ]}
            defaultValue={filters.roleId}
          >
            <SelectTrigger id="roleId" className="w-40">
              <SelectValue placeholder="Any role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any role</SelectItem>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="territoryId" className="text-xs text-muted-foreground">
            Territory
          </label>
          <Select
            name="territoryId"
            items={[
              { value: "", label: "Any territory" },
              ...territories.map((territory) => ({ value: territory.id, label: territory.name })),
            ]}
            defaultValue={filters.territoryId}
          >
            <SelectTrigger id="territoryId" className="w-44">
              <SelectValue placeholder="Any territory" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any territory</SelectItem>
              {territories.map((territory) => (
                <SelectItem key={territory.id} value={territory.id}>
                  {territory.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        {hasActiveFilters ? (
          <Button type="button" variant="ghost" render={<Link href="/admin/users" />}>
            Clear filters
          </Button>
        ) : null}
      </form>

      <div className="min-w-0 rounded-md border border-border p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Home territory</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.employeeCode}</TableCell>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.role.name}</TableCell>
                <TableCell>{user.manager?.name ?? "—"}</TableCell>
                <TableCell>{user.homeTerritory?.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={user.status === "ACTIVE" ? "default" : "secondary"}>
                    {user.status}
                  </Badge>
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  <Button
                    render={<Link href={`/admin/users/${user.id}/edit`} />}
                    variant="outline"
                    size="sm"
                  >
                    Edit
                  </Button>
                  {user.status === "ACTIVE" ? (
                    <DeactivateButton userId={user.id} userName={user.name} />
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No users match these filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
