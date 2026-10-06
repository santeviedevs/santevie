import { beforeEach, describe, expect, it, vi } from "vitest";

const findHolidaysInRange = vi.fn();
vi.mock("@/server/repositories/holiday-repository", () => ({ findHolidaysInRange }));

const findLeavesOverlappingRange = vi.fn();
vi.mock("@/server/repositories/leave-repository", () => ({ findLeavesOverlappingRange }));

const listWorkingDays = vi.fn();
vi.mock("@/server/repositories/working-day-repository", () => ({ listWorkingDays }));

const { getMyCalendarMonth } = await import("./calendar-service");

const TERRITORY_ID = "territory-1";
const USER_ID = "user-1";

// Mon-Sat working, Sunday off — the S3-01 default.
const DEFAULT_WORKING_DAYS = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  isWorking: dayOfWeek !== 0,
}));

function findDay(days: Awaited<ReturnType<typeof getMyCalendarMonth>>, date: string) {
  const day = days.find((d) => d.date === date);
  if (!day) throw new Error(`No grid day found for ${date}`);
  return day;
}

beforeEach(() => {
  vi.clearAllMocks();
  listWorkingDays.mockResolvedValue(DEFAULT_WORKING_DAYS);
  findHolidaysInRange.mockResolvedValue([]);
  findLeavesOverlappingRange.mockResolvedValue([]);
});

describe("getMyCalendarMonth", () => {
  it("marks a plain working day as working with no holiday or leave", async () => {
    // October 2026: the 15th is a Thursday.
    const days = await getMyCalendarMonth(USER_ID, TERRITORY_ID, 2026, 10);
    const day = findDay(days, "2026-10-15");
    expect(day.isWorkingDay).toBe(true);
    expect(day.holiday).toBeNull();
    expect(day.leave).toBeNull();
  });

  it("marks the configured non-working day (Sunday) as not working", async () => {
    const days = await getMyCalendarMonth(USER_ID, TERRITORY_ID, 2026, 10);
    // 2026-10-04 is a Sunday.
    const day = findDay(days, "2026-10-04");
    expect(day.isWorkingDay).toBe(false);
  });

  it("shows a territory-specific holiday spanning multiple days", async () => {
    findHolidaysInRange.mockResolvedValue([
      {
        name: "Festival Holiday",
        startDate: new Date("2026-10-20"),
        endDate: new Date("2026-10-22"),
      },
    ]);
    const days = await getMyCalendarMonth(USER_ID, TERRITORY_ID, 2026, 10);
    expect(findDay(days, "2026-10-20").holiday).toEqual({ name: "Festival Holiday" });
    expect(findDay(days, "2026-10-21").holiday).toEqual({ name: "Festival Holiday" });
    expect(findDay(days, "2026-10-22").holiday).toEqual({ name: "Festival Holiday" });
    expect(findDay(days, "2026-10-19").holiday).toBeNull();
    expect(findDay(days, "2026-10-23").holiday).toBeNull();
  });

  it("shows an all-territory holiday the same way (repository already resolves the OR)", async () => {
    findHolidaysInRange.mockResolvedValue([
      {
        name: "Independence Day",
        startDate: new Date("2026-10-02"),
        endDate: new Date("2026-10-02"),
      },
    ]);
    const days = await getMyCalendarMonth(USER_ID, TERRITORY_ID, 2026, 10);
    expect(findDay(days, "2026-10-02").holiday).toEqual({ name: "Independence Day" });
    expect(findHolidaysInRange).toHaveBeenCalledWith(
      TERRITORY_ID,
      expect.any(Date),
      expect.any(Date),
    );
  });

  it.each(["PENDING", "APPROVED", "REJECTED"] as const)(
    "shows a %s leave with its type and status",
    async (status) => {
      findLeavesOverlappingRange.mockResolvedValue([
        {
          startDate: new Date("2026-10-10"),
          endDate: new Date("2026-10-10"),
          status,
          leaveType: { name: "Annual Leave" },
        },
      ]);
      const days = await getMyCalendarMonth(USER_ID, TERRITORY_ID, 2026, 10);
      expect(findDay(days, "2026-10-10").leave).toEqual({ leaveType: "Annual Leave", status });
    },
  );

  it("shows both a holiday and a leave on the same day", async () => {
    findHolidaysInRange.mockResolvedValue([
      { name: "Local Holiday", startDate: new Date("2026-10-12"), endDate: new Date("2026-10-12") },
    ]);
    findLeavesOverlappingRange.mockResolvedValue([
      {
        startDate: new Date("2026-10-12"),
        endDate: new Date("2026-10-12"),
        status: "APPROVED",
        leaveType: { name: "Sick Leave" },
      },
    ]);
    const days = await getMyCalendarMonth(USER_ID, TERRITORY_ID, 2026, 10);
    const day = findDay(days, "2026-10-12");
    expect(day.holiday).toEqual({ name: "Local Holiday" });
    expect(day.leave).toEqual({ leaveType: "Sick Leave", status: "APPROVED" });
  });

  it("fails open (every day working, no holidays) when territoryId is null", async () => {
    const days = await getMyCalendarMonth(USER_ID, null, 2026, 10);
    expect(findWorkingDayAllTrue(days)).toBe(true);
    expect(findHolidaysInRange).not.toHaveBeenCalled();
    expect(listWorkingDays).not.toHaveBeenCalled();
  });

  it("still shows the user's own leave even when territoryId is null", async () => {
    findLeavesOverlappingRange.mockResolvedValue([
      {
        startDate: new Date("2026-10-10"),
        endDate: new Date("2026-10-10"),
        status: "APPROVED",
        leaveType: { name: "Annual Leave" },
      },
    ]);
    const days = await getMyCalendarMonth(USER_ID, null, 2026, 10);
    expect(findDay(days, "2026-10-10").leave).toEqual({
      leaveType: "Annual Leave",
      status: "APPROVED",
    });
  });

  it("never enriches grid-padding days outside the requested month", async () => {
    findHolidaysInRange.mockResolvedValue([
      {
        name: "Padding Holiday",
        startDate: new Date("2026-09-27"),
        endDate: new Date("2026-11-07"),
      },
    ]);
    findLeavesOverlappingRange.mockResolvedValue([
      {
        startDate: new Date("2026-09-27"),
        endDate: new Date("2026-11-07"),
        status: "APPROVED",
        leaveType: { name: "Annual Leave" },
      },
    ]);
    const days = await getMyCalendarMonth(USER_ID, TERRITORY_ID, 2026, 10);
    const paddingDays = days.filter((d) => !d.inCurrentMonth);
    expect(paddingDays.length).toBeGreaterThan(0);
    for (const day of paddingDays) {
      expect(day.holiday).toBeNull();
      expect(day.leave).toBeNull();
    }
  });
});

function findWorkingDayAllTrue(days: Awaited<ReturnType<typeof getMyCalendarMonth>>): boolean {
  return days.every((d) => d.isWorkingDay === true);
}
