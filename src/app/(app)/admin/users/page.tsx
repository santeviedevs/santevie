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
import { userFiltersSchema } from "@/lib/schemas/user";
import { requirePermission } from "@/server/auth/require-permission";
import {
  listActiveCommunes,
  listActiveProvinces,
  listActiveQuartiers,
  listActiveVilles,
} from "@/server/repositories/territory-repository";
import { listRoleOptions } from "@/server/repositories/user-repository";
import { getUserScope } from "@/server/scope";
import type { UserSummary } from "@/server/services/user-service";
import { listUsers } from "@/server/services/user-service";

import { UserFilters } from "./user-filters";

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

// A user's assignment can stop at any level, so the list shows whichever
// is deepest — matching what the cascading select on the form actually let
// the admin pick.
function territoryLabel(user: UserSummary): string {
  return (
    user.quartier?.name ?? user.commune?.name ?? user.ville?.name ?? user.province?.name ?? "—"
  );
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const session = await requirePermission("users:manage");

  const params = await searchParams;
  const filters = userFiltersSchema.parse({
    q: firstValue(params.q),
    roleId: firstValue(params.roleId),
    provinceId: firstValue(params.provinceId),
    villeId: firstValue(params.villeId),
    communeId: firstValue(params.communeId),
    quartierId: firstValue(params.quartierId),
    status: firstValue(params.status),
  });

  const scope = await getUserScope(session);
  const [users, roles, provinces, villes, communes, quartiers, dict] = await Promise.all([
    listUsers(filters, scope),
    listRoleOptions(),
    listActiveProvinces(),
    listActiveVilles(),
    listActiveCommunes(),
    listActiveQuartiers(),
    getServerDictionary(),
  ]);
  const t = dict.usersPage;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t.title}</h1>
        <Button render={<Link href="/admin/users/new" />}>{t.newUser}</Button>
      </div>

      <UserFilters
        roles={roles}
        provinces={provinces}
        villes={villes}
        communes={communes}
        quartiers={quartiers}
        filters={filters}
        dict={dict.filters}
        territoryDict={dict.territory}
      />

      <div className="min-w-0 rounded-md border border-border p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columnEmployeeCode}</TableHead>
              <TableHead>{t.columnName}</TableHead>
              <TableHead>{t.columnEmail}</TableHead>
              <TableHead>{t.columnRole}</TableHead>
              <TableHead>{t.columnManager}</TableHead>
              <TableHead>{t.columnTerritory}</TableHead>
              <TableHead>{t.columnStatus}</TableHead>
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
                <TableCell>{territoryLabel(user)}</TableCell>
                <TableCell>
                  <Badge variant={user.status === "ACTIVE" ? "default" : "secondary"}>
                    {user.status === "ACTIVE" ? t.statusActive : t.statusInactive}
                  </Badge>
                </TableCell>
                <TableCell className="flex justify-end">
                  <Button
                    render={<Link href={`/admin/users/${user.id}/edit`} />}
                    variant="outline"
                    size="sm"
                  >
                    {t.edit}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
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
