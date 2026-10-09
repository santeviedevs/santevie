import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
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
import { MAX_ACCEPTABLE_ACCURACY_METERS } from "@/lib/schemas/attendance";
import { cn } from "@/lib/utils";
import { requireAnyPermission } from "@/server/auth/require-permission";
import { getAttendanceRecordById } from "@/server/services/attendance-report-service";

export const dynamic = "force-dynamic";

type AttendanceDetailPageProps = { params: Promise<{ id: string }> };

function accuracyCell(value: number | null) {
  if (value === null) return "—";
  const flagged = value > MAX_ACCEPTABLE_ACCURACY_METERS;
  return (
    <span
      className={cn(flagged && "font-medium text-amber-600 dark:text-amber-400")}
    >{`${value}m`}</span>
  );
}

export default async function AttendanceDetailPage({ params }: AttendanceDetailPageProps) {
  const session = await requireAnyPermission(["reports:view-team", "reports:view-all"]);
  const dict = await getServerDictionary();
  const t = dict.attendanceAdminPage;
  const { id } = await params;

  const record = await getAttendanceRecordById(id, session);
  if (!record) notFound();

  const needsReview = record.status === "NEEDS_REVIEW";

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{record.employee.name}</h1>
        <Badge variant="secondary">{record.status}</Badge>
      </div>
      <p className="text-muted-foreground">{formatDateTime(record.date)}</p>

      {needsReview ? (
        <p className="text-sm text-amber-600 dark:text-amber-400">{t.needsReviewHint}</p>
      ) : null}

      <div className="min-w-0 rounded-md border border-border p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.checkInLabel}</TableHead>
              <TableHead>{t.accuracyColumn}</TableHead>
              <TableHead>{t.checkOutLabel}</TableHead>
              <TableHead>{t.accuracyColumn}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {record.sessions.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{formatDateTime(s.checkInAt)}</TableCell>
                <TableCell>{accuracyCell(s.checkInAccuracy)}</TableCell>
                <TableCell>{s.checkOutAt ? formatDateTime(s.checkOutAt) : "—"}</TableCell>
                <TableCell>{accuracyCell(s.checkOutAccuracy)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
