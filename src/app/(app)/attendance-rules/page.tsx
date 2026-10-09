import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format-date";
import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { listActiveUserOptions } from "@/server/repositories/user-repository";
import { getDownstreamUserIds } from "@/server/scope";
import { listAttendanceRulesForViewer } from "@/server/services/attendance-rule-service";
import { listActiveTerritoryOptions } from "@/server/services/territory-service";

import { AttendanceRuleForm } from "./attendance-rule-form";

export const dynamic = "force-dynamic";

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export default async function AttendanceRulesPage() {
  const session = await requirePermission("attendance-rules:manage");
  const dict = await getServerDictionary();
  const t = dict.attendanceRulesPage;

  const [rules, territories, allPeople] = await Promise.all([
    listAttendanceRulesForViewer(session.user.id, session.user.roleName),
    listActiveTerritoryOptions(),
    listActiveUserOptions(),
  ]);

  // Team/individual scope is hierarchy-bound (see attendance-rule-service's
  // assertScopeAuthorized) — an ADMIN may target anyone, a MANAGER/SUPERVISOR
  // only themselves or their own downstream reports, so the picker only
  // ever offers choices the server would actually accept.
  const downstream =
    session.user.roleName === "ADMIN" ? null : await getDownstreamUserIds(session.user.id);
  const people = (
    downstream === null
      ? allPeople
      : allPeople.filter((p) => p.id === session.user.id || downstream.includes(p.id))
  ).map((p) => ({ id: p.id, label: p.name }));

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{t.title}</h1>

      <AttendanceRuleForm
        territories={territories.map((territory) => ({ id: territory.id, label: territory.label }))}
        people={people}
        currentUserName={session.user.name ?? ""}
        dict={dict.attendanceRuleForm}
      />

      <div className="min-w-0 rounded-md border border-border p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columnScope}</TableHead>
              <TableHead>{t.columnTarget}</TableHead>
              <TableHead>{t.columnExpectedStart}</TableHead>
              <TableHead>{t.columnLateGrace}</TableHead>
              <TableHead>{t.columnMinimumWorked}</TableHead>
              <TableHead>{t.columnCreatedAt}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell>
                  {rule.scope === "territory"
                    ? t.scopeTerritory
                    : rule.scope === "team"
                      ? t.scopeTeam
                      : t.scopeIndividual}
                </TableCell>
                <TableCell>
                  {rule.territory?.code ?? rule.owner?.name ?? rule.targetUser?.name ?? "—"}
                </TableCell>
                <TableCell>{minutesToTime(rule.expectedStartMinutes)}</TableCell>
                <TableCell>{rule.lateGraceMinutes}</TableCell>
                <TableCell>{rule.minimumWorkedMinutes}</TableCell>
                <TableCell>{formatDateTime(rule.createdAt)}</TableCell>
              </TableRow>
            ))}
            {rules.length === 0 ? (
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
