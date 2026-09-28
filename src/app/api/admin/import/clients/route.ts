import {
  CLIENT_IMPORT_COLUMNS,
  commitClientImport,
  previewClientImport,
} from "@/server/services/import/client-import";
import {
  handleImportRequest,
  handleTemplateDownload,
} from "@/server/services/import/route-helpers";

export const dynamic = "force-dynamic";

export function GET() {
  return handleTemplateDownload("clients:manage", "Clients", CLIENT_IMPORT_COLUMNS);
}

export function POST(request: Request) {
  return handleImportRequest(request, "clients:manage", "CLIENT", {
    preview: previewClientImport,
    commit: commitClientImport,
  });
}
