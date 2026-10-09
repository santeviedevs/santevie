import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format-date";
import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getTeamOverdueFollowUps } from "@/server/services/follow-up-service";

import { FollowUpTabs } from "../follow-up-tabs";

export const dynamic = "force-dynamic";

export default async function TeamFollowUpsPage() {
  const session = await requirePermission("activities:view-team");
  const dict = await getServerDictionary();
  const t = dict.activitiesPage;

  const overdue = await getTeamOverdueFollowUps(session);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{t.teamOverdue}</h1>
      <FollowUpTabs active="team" canViewTeam dict={t} />

      <div className="min-w-0 rounded-md border border-border p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.dueDateColumn}</TableHead>
              <TableHead>{t.targetColumn}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overdue.map((followUp) => (
              <TableRow key={followUp.id}>
                <TableCell>{formatDate(followUp.dueDate)}</TableCell>
                <TableCell>
                  {followUp.activity.client?.name ?? followUp.activity.territory?.code ?? "—"}
                </TableCell>
              </TableRow>
            ))}
            {overdue.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  {t.noFollowUps}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
