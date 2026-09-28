import { Badge } from "@/components/ui/badge";
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
import { requireAnyPermission } from "@/server/auth/require-permission";
import { listRoleOptions, listUsersByRoleIds } from "@/server/repositories/user-repository";
import { getDownstreamUserIds } from "@/server/scope";
import { listTerritoryAssignments } from "@/server/services/territory-assignment-service";
import { listActiveTerritoryOptions } from "@/server/services/territory-service";
import { listUsers } from "@/server/services/user-service";

import { TeamFilters } from "./team-filters";

// Read-only — a Supervisor's or Manager's own downstream team (via
// scope.ts's existing hierarchy resolution, S1-07) and each member's
// territory assignments. Not a management screen: no create/edit/delete
// here, which is why it's gated on reports:view-team/reports:view-all
// rather than territories:manage — see the S2-04 decision log. Gated on
// either permission: reports:view-team (Supervisor) and reports:view-all
// (Manager, Admin) both mean "can see a team roster" here, even though
// they're different grants in the role matrix — Manager's broader
// permission doesn't happen to include the narrower one.
export const dynamic = "force-dynamic";

type TeamPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

export default async function TeamPage({ searchParams }: TeamPageProps) {
  const session = await requireAnyPermission(["reports:view-team", "reports:view-all"]);

  const params = await searchParams;
  const filters = userFiltersSchema.parse({
    q: firstValue(params.q),
    roleId: firstValue(params.roleId),
    managerId: firstValue(params.managerId),
    territoryId: firstValue(params.territoryId),
    status: firstValue(params.status),
  });

  const downstream = await getDownstreamUserIds(session.user.id);
  const scope = { kind: "ids", userIds: downstream } as const;

  const [members, allDownstream, roles, territories, dict] = await Promise.all([
    listUsers(filters, scope),
    listUsers({}, scope),
    listRoleOptions(),
    listActiveTerritoryOptions(),
    getServerDictionary(),
  ]);
  const t = dict.teamPage;

  // Reports-To's options depend on whether a Role is selected:
  // - No Role: the full manager-capable roster (every active Admin/
  //   Manager/Supervisor, even ones with zero current reports) — lets the
  //   viewer pre-filter by someone before they've been assigned a team.
  // - A Role selected: narrows to only managers who *actually* have
  //   someone of that role reporting to them, derived from the downstream
  //   data itself (never a hardcoded "Delegate reports to Supervisor"
  //   assumption — a Delegate reporting directly to a Manager still shows
  //   that Manager). Keeps the Role+Reports-To combination always
  //   "safe" — picking a listed manager can never silently return zero
  //   rows just because they don't actually manage anyone of that role.
  let managerOptions: { id: string; name: string; roleName: string }[];
  if (filters.roleId) {
    const roleFilteredDownstream = allDownstream.filter(
      (member) => member.role.id === filters.roleId,
    );
    managerOptions = Array.from(
      new Map(
        roleFilteredDownstream
          .filter((member) => member.manager)
          .map((member) => [
            member.manager!.id,
            {
              id: member.manager!.id,
              name: member.manager!.name,
              roleName: member.manager!.role.name,
            },
          ]),
      ).values(),
    ).sort((a, b) => a.name.localeCompare(b.name));
  } else {
    const managerCapableRoleIds = roles.filter((role) => role.name !== "DELEGATE").map((r) => r.id);
    const fullRoster = await listUsersByRoleIds(managerCapableRoleIds);
    managerOptions = fullRoster
      .map((user) => ({ id: user.id, name: user.name, roleName: user.role.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // A Supervisor's downstream is always just their own Delegates, so Role
  // and "Reports to" would only ever have one possible value — hidden
  // rather than shown with nothing to filter.
  const showRoleAndManagerFilters = session.user.roleName !== "SUPERVISOR";

  const assignmentsByMember = await Promise.all(
    members.map((member) => listTerritoryAssignments(member.id)),
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{t.title}</h1>

      <TeamFilters
        roles={roles}
        managers={managerOptions}
        territories={territories}
        filters={filters}
        dict={dict.filters}
        territoryDict={dict.territory}
        showRoleAndManagerFilters={showRoleAndManagerFilters}
      />

      <div className="min-w-0 rounded-md border border-border p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columnEmployeeCode}</TableHead>
              <TableHead>{t.columnName}</TableHead>
              <TableHead>{t.columnRole}</TableHead>
              <TableHead>{t.columnReportsTo}</TableHead>
              <TableHead>{t.columnTerritories}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member, index) => (
              <TableRow key={member.id}>
                <TableCell>{member.employeeCode}</TableCell>
                <TableCell>{member.name}</TableCell>
                <TableCell>{member.role.name}</TableCell>
                <TableCell>
                  {member.manager
                    ? `${member.manager.name} (${member.manager.role.name})`
                    : t.noManager}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {assignmentsByMember[index]!.length === 0 ? (
                      <span className="text-sm text-muted-foreground">{t.noAssignments}</span>
                    ) : (
                      assignmentsByMember[index]!.map((assignment) => (
                        <Badge key={assignment.id} variant="secondary">
                          {assignment.code}
                        </Badge>
                      ))
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
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
