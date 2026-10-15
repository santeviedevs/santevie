import { NextResponse } from "next/server";

import { emballageReportParamsSchema } from "@/lib/schemas/emballage";
import {
  ForbiddenError,
  requirePermission,
  SessionExpiredError,
} from "@/server/auth/require-permission";
import { buildEmballageReportWorkbook } from "@/server/services/emballage-export-service";
import { getEmballageReport } from "@/server/services/emballage-service";

export const dynamic = "force-dynamic";

// Route handler, not a Server Action — same reasoning as the attendance
// export: generated on the server, same filters and same underlying query
// as the on-screen EOM report, so the export can never disagree with what
// the link was clicked from.
export async function GET(request: Request) {
  try {
    await requirePermission("emballage:view-team");
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
  const filters = emballageReportParamsSchema.parse({
    periodMonth: searchParams.get("periodMonth") ?? undefined,
    periodYear: searchParams.get("periodYear") ?? undefined,
    centerId: searchParams.get("centerId") ?? undefined,
    productId: searchParams.get("productId") ?? undefined,
  });

  const lines = await getEmballageReport(
    filters.periodMonth,
    filters.periodYear,
    filters.centerId,
    filters.productId,
  );
  const buffer = await buildEmballageReportWorkbook(lines);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="emballage-report.xlsx"',
    },
  });
}
