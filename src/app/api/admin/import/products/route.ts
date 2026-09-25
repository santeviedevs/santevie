import {
  commitProductImport,
  previewProductImport,
  PRODUCT_IMPORT_COLUMNS,
} from "@/server/services/import/product-import";
import {
  handleImportRequest,
  handleTemplateDownload,
} from "@/server/services/import/route-helpers";

export const dynamic = "force-dynamic";

export function GET() {
  return handleTemplateDownload("products:manage", "Products", PRODUCT_IMPORT_COLUMNS);
}

export function POST(request: Request) {
  return handleImportRequest(request, "products:manage", "PRODUCT", {
    preview: previewProductImport,
    commit: commitProductImport,
  });
}
