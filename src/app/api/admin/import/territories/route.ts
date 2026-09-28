import {
  handleImportRequest,
  handleTemplateDownload,
} from "@/server/services/import/route-helpers";
import {
  commitTerritoryImport,
  previewTerritoryImport,
  TERRITORY_IMPORT_COLUMNS,
} from "@/server/services/import/territory-import";

export const dynamic = "force-dynamic";

export function GET() {
  return handleTemplateDownload("territories:manage", "Territories", TERRITORY_IMPORT_COLUMNS);
}

export function POST(request: Request) {
  return handleImportRequest(request, "territories:manage", "TERRITORY", {
    preview: previewTerritoryImport,
    commit: commitTerritoryImport,
  });
}
