import ExcelJS from "exceljs";

import type { AttendanceReportSummary } from "@/server/services/attendance-report-service";

const COLUMNS = [
  "Date",
  "Employee",
  "Employee Code",
  "Territory",
  "Status",
  "Check-In",
  "Check-Out",
] as const;

// Mirrors excel-utils.ts's buildImportTemplate construction (one bold
// header row, fixed column widths) but for exporting report rows rather
// than generating an import template. One row per attendance *session* so
// a day with several check-in/out cycles isn't collapsed into one row —
// the day-level fields (date/employee/territory/status) simply repeat.
export async function buildAttendanceReportWorkbook(
  rows: AttendanceReportSummary[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Attendance");
  sheet.addRow([...COLUMNS]);
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => {
    column.width = 20;
  });

  for (const row of rows) {
    const sessions = row.sessions.length > 0 ? row.sessions : [null];
    for (const session of sessions) {
      sheet.addRow([
        row.date.toISOString().slice(0, 10),
        row.employee.name,
        row.employee.employeeCode,
        row.territory?.code ?? "",
        row.status,
        session?.checkInAt.toISOString() ?? "",
        session?.checkOutAt?.toISOString() ?? "",
      ]);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
