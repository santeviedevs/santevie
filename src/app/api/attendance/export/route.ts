import { NextResponse } from "next/server";

import { attendanceReportFiltersSchema } from "@/lib/schemas/attendance-report";
import {
  ForbiddenError,
  requireAnyPermission,
  SessionExpiredError,
} from "@/server/auth/require-permission";
import { buildAttendanceReportWorkbook } from "@/server/services/attendance-export-service";
import {
  ExportTooLargeError,
  getAttendanceReportForExport,
} from "@/server/services/attendance-report-service";

export const dynamic = "force-dynamic";

// Route handler, not a Server Action — Section 9's watch-out: a large
// export can take longer than a Server Action's body/time budget allows.
// Takes exactly the same filters as the on-screen report (same Zod schema),
// and the service layer applies the identical scope — an export can never
// show different data than what's on the screen that links to it.
export async function GET(request: Request) {
  let session;
  try {
    session = await requireAnyPermission(["reports:view-team", "reports:view-all"]);
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const { searchParams } = new URL(request.url);
  const filters = attendanceReportFiltersSchema.parse({
    employeeId: searchParams.get("employeeId") ?? undefined,
    territoryId: searchParams.get("territoryId") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });

  try {
    const rows = await getAttendanceReportForExport(filters, session);
    const buffer = await buildAttendanceReportWorkbook(rows);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="attendance-report.xlsx"',
      },
    });
  } catch (error) {
    if (error instanceof ExportTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
