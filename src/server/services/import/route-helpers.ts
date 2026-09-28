import { NextResponse } from "next/server";

import type { Permission } from "@/server/auth/permissions";
import {
  ForbiddenError,
  requirePermission,
  SessionExpiredError,
} from "@/server/auth/require-permission";
import { type ImportEntityType, recordImportBatch } from "@/server/services/import-batch-service";

import {
  buildErrorReport,
  buildImportTemplate,
  ImportTooLargeError,
  parseImportFile,
} from "./excel-utils";
import type { ImportProgress, ImportRowOutcome, ImportSummary } from "./types";

// Every import route handler is a thin wrapper around these two functions
// — Section 9's watch-out is exactly why this lives in a route handler
// (src/app/api/...) instead of a Server Action: an upload can exceed a
// Server Action's body-size limit.

async function requireOrRespond(permission: Permission) {
  try {
    const session = await requirePermission(permission);
    return { session, response: null as NextResponse | null };
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      return {
        session: null,
        response: NextResponse.json({ error: "Session expired" }, { status: 401 }),
      };
    }
    if (error instanceof ForbiddenError) {
      return {
        session: null,
        response: NextResponse.json({ error: error.message }, { status: 403 }),
      };
    }
    throw error;
  }
}

export async function handleTemplateDownload(
  permission: Permission,
  sheetName: string,
  columns: readonly string[],
): Promise<NextResponse> {
  const { response } = await requireOrRespond(permission);
  if (response) return response;

  const buffer = await buildImportTemplate(sheetName, [...columns]);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${sheetName.toLowerCase()}-import-template.xlsx"`,
    },
  });
}

type ImportRunner = {
  preview: (
    rows: Record<string, string>[],
    actorId: string,
    onProgress?: ImportProgress,
  ) => Promise<ImportRowOutcome<unknown>[]>;
  commit: (
    rows: Record<string, string>[],
    actorId: string,
    onProgress?: ImportProgress,
  ) => Promise<{
    summary: ImportSummary;
    linkWarnings?: { row: number; errors: string[] }[];
  }>;
};

// One JSON object per line (NDJSON), not a single JSON response — a
// 500+ row file can take real time to resolve/write, and the client needs
// a live "row N of M" percentage rather than a bar frozen at 100% (the
// upload finishes almost instantly; it's the row-by-row work after that
// takes time). `xhr.responseText` grows as each line arrives, so the
// client can parse completed lines mid-request without waiting for the
// response to finish.
type StreamEvent =
  | { type: "progress"; done: number; total: number }
  | { type: "result"; data: unknown }
  | { type: "error"; message: string };

function streamImportResult(run: (onProgress: ImportProgress) => Promise<unknown>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: StreamEvent) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      }
      try {
        const data = await run((done, total) => send({ type: "progress", done, total }));
        send({ type: "result", data });
      } catch (error) {
        send({
          type: "error",
          message: error instanceof Error ? error.message : "Import failed.",
        });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}

// mode=preview: resolves and classifies every row (create/update/reject),
// writing nothing. mode=commit: re-resolves the same file and actually
// writes it, then records an ImportBatch. mode=error-report: takes the
// preview's own error list back (not the file) and returns it as a
// downloadable .xlsx, so fixing a source file never requires re-uploading
// just to see the same errors again.
export async function handleImportRequest(
  request: Request,
  permission: Permission,
  entity: ImportEntityType,
  runner: ImportRunner,
): Promise<Response> {
  const { session, response } = await requireOrRespond(permission);
  if (response) return response;

  const formData = await request.formData();
  const mode = formData.get("mode");

  if (mode === "error-report") {
    const errorsField = formData.get("errors");
    if (typeof errorsField !== "string") {
      return NextResponse.json({ error: "Missing errors payload." }, { status: 400 });
    }
    const errors = JSON.parse(errorsField) as { row: number; errors: string[] }[];
    const buffer = await buildErrorReport(errors);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="import-errors.xlsx"',
      },
    });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  let rows: Record<string, string>[];
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    ({ rows } = await parseImportFile(buffer));
  } catch (error) {
    if (error instanceof ImportTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Could not read this file. Confirm it's a valid .xlsx export." },
      {
        status: 400,
      },
    );
  }

  if (mode === "preview") {
    return streamImportResult(async (onProgress) => {
      const outcomes = await runner.preview(rows, session!.user.id, onProgress);
      return {
        totalRows: rows.length,
        willCreate: outcomes.filter((o) => o.action === "create").length,
        willUpdate: outcomes.filter((o) => o.action === "update").length,
        willReject: outcomes.filter((o) => o.action === "reject").length,
        errors: outcomes
          .filter(
            (o): o is Extract<ImportRowOutcome<unknown>, { action: "reject" }> =>
              o.action === "reject",
          )
          .map((o) => ({ row: o.row, errors: o.errors })),
      };
    });
  }

  if (mode === "commit") {
    return streamImportResult(async (onProgress) => {
      const { summary, linkWarnings } = await runner.commit(rows, session!.user.id, onProgress);
      await recordImportBatch(entity, file.name, summary, session!.user.id);
      return {
        totalRows: summary.totalRows,
        created: summary.createdCount,
        updated: summary.updatedCount,
        rejected: summary.rejectedCount,
        errors: summary.errors,
        linkWarnings: linkWarnings ?? [],
      };
    });
  }

  return NextResponse.json({ error: "Unknown mode." }, { status: 400 });
}
