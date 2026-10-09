import { beforeEach, describe, expect, it, vi } from "vitest";

const findAttendanceRecords = vi.fn();
const countAttendanceRecords = vi.fn();
const findAttendanceById = vi.fn();
const findAttendanceForDate = vi.fn();
vi.mock("@/server/repositories/attendance-report-repository", () => ({
  findAttendanceRecords,
  countAttendanceRecords,
  findAttendanceById,
  findAttendanceForDate,
}));

const getUserScope = vi.fn();
const isWithinScope = vi.fn();
const scopeUserIds = vi.fn();
vi.mock("@/server/scope", () => ({ getUserScope, isWithinScope, scopeUserIds }));

const {
  getAttendanceReport,
  getAttendanceReportForExport,
  getAttendanceRecordById,
  EXPORT_ROW_LIMIT,
  ExportTooLargeError,
} = await import("./attendance-report-service");

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "att-1",
    userId: "delegate-1",
    date: new Date("2026-06-01T00:00:00.000Z"),
    status: "PRESENT",
    user: {
      id: "delegate-1",
      name: "Jane Delegate",
      employeeCode: "D-001",
      territory: { id: "territory-1", code: "T1" },
    },
    sessions: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  findAttendanceRecords.mockResolvedValue([]);
  countAttendanceRecords.mockResolvedValue(0);
});

describe("getAttendanceReport scope enforcement", () => {
  const session = { user: { id: "supervisor-1", roleName: "SUPERVISOR" } };

  it("a SUPERVISOR requesting an employeeId outside their scope gets zero results, never the full team", async () => {
    getUserScope.mockResolvedValue({ kind: "ids", userIds: ["supervisor-1", "report-1"] });
    scopeUserIds.mockReturnValue(["supervisor-1", "report-1"]);

    await getAttendanceReport(
      { employeeId: "someone-elses-report", page: 1, pageSize: 20 },
      session,
    );

    // The resolved userIds passed to the repository must be an empty
    // array — not the supervisor's full scope, which would leak another
    // team's attendance the moment the repository ignored employeeId.
    expect(findAttendanceRecords).toHaveBeenCalledWith(expect.anything(), []);
  });

  it("a SUPERVISOR requesting an employeeId inside their own scope is narrowed to just that one id", async () => {
    getUserScope.mockResolvedValue({ kind: "ids", userIds: ["supervisor-1", "report-1"] });
    scopeUserIds.mockReturnValue(["supervisor-1", "report-1"]);

    await getAttendanceReport({ employeeId: "report-1", page: 1, pageSize: 20 }, session);

    expect(findAttendanceRecords).toHaveBeenCalledWith(expect.anything(), ["report-1"]);
  });

  it("an unrestricted scope (ADMIN/MANAGER) with no employeeId filter passes undefined through, not an artificial list", async () => {
    getUserScope.mockResolvedValue({ kind: "all" });
    scopeUserIds.mockReturnValue(undefined);

    await getAttendanceReport(
      { page: 1, pageSize: 20 },
      { user: { id: "admin-1", roleName: "ADMIN" } },
    );

    expect(findAttendanceRecords).toHaveBeenCalledWith(expect.anything(), undefined);
  });
});

describe("getAttendanceRecordById", () => {
  it("returns null for a record outside the viewer's scope, same as a missing record", async () => {
    findAttendanceById.mockResolvedValue(row({ userId: "someone-elses-report" }));
    getUserScope.mockResolvedValue({ kind: "ids", userIds: ["supervisor-1", "report-1"] });
    isWithinScope.mockReturnValue(false);

    const result = await getAttendanceRecordById("att-1", {
      user: { id: "supervisor-1", roleName: "SUPERVISOR" },
    });

    expect(result).toBeNull();
  });

  it("returns the record when it falls within the viewer's scope", async () => {
    findAttendanceById.mockResolvedValue(row());
    getUserScope.mockResolvedValue({ kind: "ids", userIds: ["supervisor-1", "delegate-1"] });
    isWithinScope.mockReturnValue(true);

    const result = await getAttendanceRecordById("att-1", {
      user: { id: "supervisor-1", roleName: "SUPERVISOR" },
    });

    expect(result?.id).toBe("att-1");
  });
});

describe("getAttendanceReportForExport reconciliation", () => {
  const session = { user: { id: "admin-1", roleName: "ADMIN" } };

  it("exports exactly the same rows the filtered count reports, under the row limit", async () => {
    getUserScope.mockResolvedValue({ kind: "all" });
    scopeUserIds.mockReturnValue(undefined);
    const rows = [row({ id: "att-1" }), row({ id: "att-2" })];
    countAttendanceRecords.mockResolvedValue(rows.length);
    findAttendanceRecords.mockResolvedValue(rows);

    const result = await getAttendanceReportForExport({ page: 1, pageSize: 20 }, session);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(["att-1", "att-2"]);
  });

  it("refuses to export when the filtered count exceeds the row limit, rather than silently truncating", async () => {
    getUserScope.mockResolvedValue({ kind: "all" });
    scopeUserIds.mockReturnValue(undefined);
    countAttendanceRecords.mockResolvedValue(EXPORT_ROW_LIMIT + 1);

    await expect(getAttendanceReportForExport({ page: 1, pageSize: 20 }, session)).rejects.toThrow(
      ExportTooLargeError,
    );
    expect(findAttendanceRecords).not.toHaveBeenCalled();
  });
});
