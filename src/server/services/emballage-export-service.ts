import ExcelJS from "exceljs";

import type { EmballageReportLine } from "@/server/services/emballage-service";

const COLUMNS = ["Centre", "Product", "Total Quantity", "Collections"] as const;

// Mirrors attendance-export-service.ts's construction (one bold header
// row, fixed column widths) — one row per centre x product total, exactly
// what the on-screen report shows, so the export never disagrees with the
// screen it's linked from.
export async function buildEmballageReportWorkbook(lines: EmballageReportLine[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Emballage");
  sheet.addRow([...COLUMNS]);
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => {
    column.width = 24;
  });

  for (const line of lines) {
    sheet.addRow([line.centerName, line.productName, line.totalQuantity, line.collectionCount]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
