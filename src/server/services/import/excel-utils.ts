import ExcelJS from "exceljs";

// S2-05: the confirmed row ceiling for a single import — large enough for
// realistic master-data batches, small enough to stay inside a single
// synchronous request (Section 4's serverless execution-time watch-out).
// Above this, the file is rejected outright rather than silently truncated.
export const IMPORT_ROW_LIMIT = 5000;

export class ImportTooLargeError extends Error {
  constructor(rowCount: number) {
    super(
      `This file has ${rowCount} rows, which is over the ${IMPORT_ROW_LIMIT}-row limit for a single import. Split it into smaller files.`,
    );
    this.name = "ImportTooLargeError";
  }
}

// A blank .xlsx with one bold header row, generated from the same column
// list the parser and resolver use below — so the template can never
// drift out of sync with what an upload actually accepts.
export async function buildImportTemplate(sheetName: string, columns: string[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(columns);
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => {
    column.width = 22;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Parses the first sheet into plain trimmed-string rows keyed by header —
// every row resolver below works from strings only, the same shape a
// submitted form would produce, so the same validation code path applies
// regardless of whether the value came from a browser field or a
// spreadsheet cell. Fully blank rows (a trailing empty row Excel often
// leaves behind) are skipped rather than rejected.
export async function parseImportFile(
  buffer: Buffer,
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? "").trim();
  });

  const rows: Record<string, string>[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const isBlank = headers.every((_, index) => {
      const value = row.getCell(index + 1).value;
      return value === null || value === undefined || String(value).trim() === "";
    });
    if (isBlank) continue;

    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      const value = row.getCell(index + 1).value;
      record[header] = value === null || value === undefined ? "" : String(value).trim();
    });
    rows.push(record);
  }

  if (rows.length > IMPORT_ROW_LIMIT) throw new ImportTooLargeError(rows.length);

  return { headers, rows };
}

// The downloadable error report (S2-05: "no silent failures") — one row
// per rejected spreadsheet row, with every reason it failed, so the
// person can fix their source file without this screen open.
export async function buildErrorReport(
  errors: { row: number; errors: string[] }[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Errors");
  sheet.addRow(["Row", "Errors"]);
  sheet.getRow(1).font = { bold: true };
  sheet.getColumn(1).width = 10;
  sheet.getColumn(2).width = 80;
  for (const entry of errors) {
    sheet.addRow([entry.row, entry.errors.join("; ")]);
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
