import {
  CENTER_IMPORT_COLUMNS,
  commitCenterImport,
  previewCenterImport,
} from "@/server/services/import/center-import";
import {
  handleImportRequest,
  handleTemplateDownload,
} from "@/server/services/import/route-helpers";

export const dynamic = "force-dynamic";

export function GET() {
  return handleTemplateDownload("centers:manage", "Centers", CENTER_IMPORT_COLUMNS);
}

export function POST(request: Request) {
  return handleImportRequest(request, "centers:manage", "CENTER", {
    preview: previewCenterImport,
    commit: commitCenterImport,
  });
}
