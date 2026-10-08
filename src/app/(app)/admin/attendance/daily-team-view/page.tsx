import Link from "next/link";

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
import { requireAnyPermission } from "@/server/auth/require-permission";
import { getTeamDailyView } from "@/server/services/attendance-report-service";

export const dynamic = "force-dynamic";

type DailyTeamViewPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export default async function DailyTeamViewPage({ searchParams }: DailyTeamViewPageProps) {
  const session = await requireAnyPermission(["reports:view-team", "reports:view-all"]);
  const dict = await getServerDictionary();
  const t = dict.attendanceAdminPage;

  const params = await searchParams;
  const dateParam = Array.isArray(params.date) ? params.date[0] : params.date;
  const date = startOfUtcDay(dateParam ? new Date(dateParam) : new Date());

  const records = await getTeamDailyView(date, session);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{t.dailyTeamView}</h1>

      <div className="min-w-0 rounded-md border border-border p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columnEmployee}</TableHead>
              <TableHead>{t.columnTerritory}</TableHead>
              <TableHead>{t.columnStatus}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id}>
                <TableCell>
                  <Link href={`/admin/attendance/${record.id}`} className="underline">
                    {record.employee.name}
                  </Link>
                </TableCell>
                <TableCell>{record.territory?.code ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{record.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
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
