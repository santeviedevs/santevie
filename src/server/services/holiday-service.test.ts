import { beforeEach, describe, expect, it, vi } from "vitest";

const countFilteredHolidays = vi.fn();
const createHolidayRow = vi.fn();
const findHolidayById = vi.fn();
const findHolidays = vi.fn();
const updateHolidayRow = vi.fn();
vi.mock("@/server/repositories/holiday-repository", () => ({
  countFilteredHolidays,
  createHolidayRow,
  findHolidayById,
  findHolidays,
  updateHolidayRow,
}));

const { createHoliday, updateHoliday, getHoliday } = await import("./holiday-service");

const baseHolidayRow = (overrides: Record<string, unknown> = {}) => ({
  id: "holiday-1",
  name: "Eid al-Fitr",
  startDate: new Date("2026-03-21"),
  endDate: new Date("2026-03-21"),
  status: "ACTIVE",
  territory: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createHoliday", () => {
  it("creates an all-territory holiday when territoryId is omitted", async () => {
    createHolidayRow.mockResolvedValue(baseHolidayRow());
    const result = await createHoliday(
      { name: "Eid al-Fitr", startDate: "2026-03-21", endDate: "2026-03-21" },
      "actor-1",
    );
    expect(result.territory).toBeNull();
    expect(createHolidayRow).toHaveBeenCalledWith(
      expect.objectContaining({ territory: undefined }),
    );
  });

  it("creates a territory-scoped holiday", async () => {
    createHolidayRow.mockResolvedValue(
      baseHolidayRow({ territory: { id: "territory-1", code: "TER-00001" } }),
    );
    await createHoliday(
      {
        name: "Local Holiday",
        startDate: "2026-04-14",
        endDate: "2026-04-14",
        territoryId: "territory-1",
      },
      "actor-1",
    );
    expect(createHolidayRow).toHaveBeenCalledWith(
      expect.objectContaining({ territory: { connect: { id: "territory-1" } } }),
    );
  });

  it("applies every date in a multi-day range (persisted as-is; range coverage is isWorkingDay's job)", async () => {
    createHolidayRow.mockResolvedValue(
      baseHolidayRow({ startDate: new Date("2026-10-20"), endDate: new Date("2026-10-22") }),
    );
    const result = await createHoliday(
      { name: "Festival Holiday", startDate: "2026-10-20", endDate: "2026-10-22" },
      "actor-1",
    );
    expect(result.startDate).toEqual(new Date("2026-10-20"));
    expect(result.endDate).toEqual(new Date("2026-10-22"));
  });
});

describe("updateHoliday", () => {
  it("deactivating a holiday persists without any dependents check", async () => {
    updateHolidayRow.mockResolvedValue(baseHolidayRow({ status: "INACTIVE" }));
    const result = await updateHoliday(
      {
        id: "holiday-1",
        name: "Eid al-Fitr",
        startDate: "2026-03-21",
        endDate: "2026-03-21",
        status: "INACTIVE",
      },
      "actor-1",
    );
    expect(result.status).toBe("INACTIVE");
  });
});

describe("getHoliday", () => {
  it("returns null when the holiday doesn't exist", async () => {
    findHolidayById.mockResolvedValue(null);
    await expect(getHoliday("missing")).resolves.toBeNull();
  });
});
