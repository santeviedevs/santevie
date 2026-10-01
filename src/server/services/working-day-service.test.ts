import { beforeEach, describe, expect, it, vi } from "vitest";

const findActiveHolidayCoveringDate = vi.fn();
vi.mock("@/server/repositories/holiday-repository", () => ({ findActiveHolidayCoveringDate }));

const findApprovedLeaveCoveringDate = vi.fn();
vi.mock("@/server/repositories/leave-repository", () => ({ findApprovedLeaveCoveringDate }));

const findWorkingDay = vi.fn();
const listWorkingDays = vi.fn();
const upsertWorkingDay = vi.fn();
vi.mock("@/server/repositories/working-day-repository", () => ({
  findWorkingDay,
  listWorkingDays,
  upsertWorkingDay,
}));

const { isWorkingDay, getWorkingDays, updateWorkingDays } = await import("./working-day-service");

const TERRITORY_ID = "territory-1";
const USER_ID = "user-1";

// Wednesday, 7 Jan 2026 — a normal working day under Mon-Sat/Sunday-off.
const WEDNESDAY = new Date("2026-01-07T00:00:00.000Z");
// Sunday, 4 Jan 2026 — the seeded non-working day.
const SUNDAY = new Date("2026-01-04T00:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  findWorkingDay.mockResolvedValue({ dayOfWeek: WEDNESDAY.getUTCDay(), isWorking: true });
  findActiveHolidayCoveringDate.mockResolvedValue(null);
  findApprovedLeaveCoveringDate.mockResolvedValue(null);
});

describe("isWorkingDay", () => {
  it("returns true for a normal working day", async () => {
    await expect(isWorkingDay(WEDNESDAY, TERRITORY_ID)).resolves.toBe(true);
  });

  it("returns false for a configured non-working day", async () => {
    findWorkingDay.mockResolvedValue({ dayOfWeek: SUNDAY.getUTCDay(), isWorking: false });
    await expect(isWorkingDay(SUNDAY, TERRITORY_ID)).resolves.toBe(false);
  });

  it("defaults to working when the territory has no config row at all", async () => {
    findWorkingDay.mockResolvedValue(null);
    await expect(isWorkingDay(WEDNESDAY, TERRITORY_ID)).resolves.toBe(true);
  });

  it("returns false for a territory-specific holiday", async () => {
    findActiveHolidayCoveringDate.mockResolvedValue({ id: "holiday-1" });
    await expect(isWorkingDay(WEDNESDAY, TERRITORY_ID)).resolves.toBe(false);
  });

  it("returns false for an all-territory holiday", async () => {
    findActiveHolidayCoveringDate.mockResolvedValue({ id: "holiday-2" });
    await expect(isWorkingDay(WEDNESDAY, TERRITORY_ID)).resolves.toBe(false);
    // The repository itself is responsible for matching territoryId OR
    // null — this just confirms the service treats a hit as non-working
    // regardless of which case matched.
    expect(findActiveHolidayCoveringDate).toHaveBeenCalledWith(TERRITORY_ID, WEDNESDAY);
  });

  it("treats every date inside a multi-day holiday range as non-working", async () => {
    findActiveHolidayCoveringDate.mockResolvedValue({ id: "holiday-3" });
    const middleOfRange = new Date("2026-01-08T00:00:00.000Z");
    await expect(isWorkingDay(middleOfRange, TERRITORY_ID)).resolves.toBe(false);
  });

  it("returns true outside a holiday range when otherwise working", async () => {
    findActiveHolidayCoveringDate.mockResolvedValue(null);
    await expect(isWorkingDay(WEDNESDAY, TERRITORY_ID)).resolves.toBe(true);
  });

  it("returns false when the user has approved leave covering the date", async () => {
    findApprovedLeaveCoveringDate.mockResolvedValue({ id: "leave-1" });
    await expect(isWorkingDay(WEDNESDAY, TERRITORY_ID, USER_ID)).resolves.toBe(false);
  });

  it("does not check leave at all when no userId is given", async () => {
    await isWorkingDay(WEDNESDAY, TERRITORY_ID);
    expect(findApprovedLeaveCoveringDate).not.toHaveBeenCalled();
  });

  it("ignores leave belonging to a different user (repository already scopes by userId)", async () => {
    findApprovedLeaveCoveringDate.mockResolvedValue(null);
    await isWorkingDay(WEDNESDAY, TERRITORY_ID, USER_ID);
    expect(findApprovedLeaveCoveringDate).toHaveBeenCalledWith(USER_ID, WEDNESDAY);
  });

  it("does not treat a different territory's holiday as applying here", async () => {
    // Repository is trusted to scope by territoryId; this asserts the
    // service passes the correct territoryId through rather than a
    // hardcoded or swapped value.
    await isWorkingDay(WEDNESDAY, TERRITORY_ID);
    expect(findActiveHolidayCoveringDate).toHaveBeenCalledWith(TERRITORY_ID, WEDNESDAY);
  });
});

describe("updateWorkingDays / getWorkingDays", () => {
  it("returns the updated configuration immediately after a save", async () => {
    upsertWorkingDay.mockImplementation((territoryId, dayOfWeek, isWorking) =>
      Promise.resolve({ territoryId, dayOfWeek, isWorking }),
    );

    const updated = await updateWorkingDays(
      {
        territoryId: TERRITORY_ID,
        days: [
          { dayOfWeek: 0, isWorking: true },
          { dayOfWeek: 5, isWorking: false },
        ],
      },
      "actor-1",
    );

    expect(updated).toEqual([
      { dayOfWeek: 0, isWorking: true },
      { dayOfWeek: 5, isWorking: false },
    ]);
    expect(upsertWorkingDay).toHaveBeenCalledWith(TERRITORY_ID, 0, true, "actor-1");
    expect(upsertWorkingDay).toHaveBeenCalledWith(TERRITORY_ID, 5, false, "actor-1");
  });

  it("reads through listWorkingDays", async () => {
    listWorkingDays.mockResolvedValue([{ dayOfWeek: 1, isWorking: true }]);
    await expect(getWorkingDays(TERRITORY_ID)).resolves.toEqual([
      { dayOfWeek: 1, isWorking: true },
    ]);
    expect(listWorkingDays).toHaveBeenCalledWith(TERRITORY_ID);
  });
});
