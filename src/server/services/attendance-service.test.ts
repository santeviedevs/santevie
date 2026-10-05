import { beforeEach, describe, expect, it, vi } from "vitest";

const findAttendanceForDate = vi.fn();
const createCheckIn = vi.fn();
vi.mock("@/server/repositories/attendance-repository", () => ({
  findAttendanceForDate,
  createCheckIn,
}));

const findUserById = vi.fn();
vi.mock("@/server/repositories/user-repository", () => ({ findUserById }));

const isWorkingDay = vi.fn();
vi.mock("@/server/services/working-day-service", () => ({ isWorkingDay }));

const {
  checkIn,
  getEffectiveRequiresLocation,
  UserNotFoundError,
  NotAWorkingDayError,
  AlreadyCheckedInError,
  LocationRequiredError,
  LocationAccuracyTooLowError,
} = await import("./attendance-service");

const baseUser = (overrides: Record<string, unknown> = {}) => ({
  id: "user-1",
  territoryId: "territory-1",
  requiresLocation: null as boolean | null,
  role: { requiresLocation: true },
  ...overrides,
});

const baseAttendanceRow = (overrides: Record<string, unknown> = {}) => ({
  id: "att-1",
  userId: "user-1",
  date: new Date("2026-10-01T00:00:00.000Z"),
  checkInAt: new Date("2026-10-01T08:00:00.000Z"),
  checkInLat: null,
  checkInLng: null,
  checkInAccuracy: null,
  ...overrides,
});

const goodFix = {
  lat: 25.2048,
  lng: 55.2708,
  accuracy: 20,
  deviceTimestamp: "2026-10-01T08:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  isWorkingDay.mockResolvedValue(true);
  findAttendanceForDate.mockResolvedValue(null);
  createCheckIn.mockResolvedValue(baseAttendanceRow());
});

describe("checkIn — location requirement resolution", () => {
  it("requires location for a user whose role defaults to requiring it (override absent)", async () => {
    findUserById.mockResolvedValueOnce(
      baseUser({ requiresLocation: null, role: { requiresLocation: true } }),
    );

    await expect(checkIn("user-1", {})).rejects.toThrow(LocationRequiredError);
  });

  it("does not require location for a user whose role defaults to not requiring it", async () => {
    findUserById.mockResolvedValueOnce(
      baseUser({ requiresLocation: null, role: { requiresLocation: false } }),
    );

    await expect(checkIn("user-1", {})).resolves.toBeDefined();
    expect(createCheckIn).toHaveBeenCalled();
  });

  it("a user-level override of true wins even when the role default is false", async () => {
    findUserById.mockResolvedValueOnce(
      baseUser({ requiresLocation: true, role: { requiresLocation: false } }),
    );

    await expect(checkIn("user-1", {})).rejects.toThrow(LocationRequiredError);
  });

  it("a user-level override of false wins even when the role default is true", async () => {
    findUserById.mockResolvedValueOnce(
      baseUser({ requiresLocation: false, role: { requiresLocation: true } }),
    );

    await expect(checkIn("user-1", {})).resolves.toBeDefined();
    expect(createCheckIn).toHaveBeenCalled();
  });
});

describe("checkIn — location quality", () => {
  it("succeeds with a good-accuracy fix for a location-required user", async () => {
    findUserById.mockResolvedValueOnce(baseUser());

    await expect(checkIn("user-1", goodFix)).resolves.toBeDefined();
    expect(createCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({ checkInLat: goodFix.lat, checkInLng: goodFix.lng }),
    );
  });

  it("rejects a fix worse than the accuracy threshold", async () => {
    findUserById.mockResolvedValueOnce(baseUser());

    await expect(checkIn("user-1", { ...goodFix, accuracy: 500 })).rejects.toThrow(
      LocationAccuracyTooLowError,
    );
    expect(createCheckIn).not.toHaveBeenCalled();
  });

  it("does not evaluate accuracy at all when no location was sent and none is required", async () => {
    findUserById.mockResolvedValueOnce(
      baseUser({ requiresLocation: false, role: { requiresLocation: false } }),
    );

    await expect(checkIn("user-1", {})).resolves.toBeDefined();
    expect(createCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({ checkInLat: undefined, checkInLng: undefined }),
    );
  });
});

describe("checkIn — guards", () => {
  it("rejects when the user has already checked in today", async () => {
    findUserById.mockResolvedValueOnce(
      baseUser({ requiresLocation: false, role: { requiresLocation: false } }),
    );
    findAttendanceForDate.mockResolvedValueOnce(baseAttendanceRow());

    await expect(checkIn("user-1", {})).rejects.toThrow(AlreadyCheckedInError);
    expect(createCheckIn).not.toHaveBeenCalled();
  });

  it("rejects check-in on a non-working day", async () => {
    findUserById.mockResolvedValueOnce(
      baseUser({ requiresLocation: false, role: { requiresLocation: false } }),
    );
    isWorkingDay.mockResolvedValueOnce(false);

    await expect(checkIn("user-1", {})).rejects.toThrow(NotAWorkingDayError);
    expect(createCheckIn).not.toHaveBeenCalled();
  });

  it("fails open (treats as working) for a user with no assigned territory", async () => {
    findUserById.mockResolvedValueOnce(
      baseUser({
        territoryId: null,
        requiresLocation: false,
        role: { requiresLocation: false },
      }),
    );

    await expect(checkIn("user-1", {})).resolves.toBeDefined();
    expect(isWorkingDay).not.toHaveBeenCalled();
  });

  it("throws when the user doesn't exist", async () => {
    findUserById.mockResolvedValueOnce(null);

    await expect(checkIn("ghost", {})).rejects.toThrow(UserNotFoundError);
  });
});

describe("getEffectiveRequiresLocation", () => {
  it("resolves the user override when present", async () => {
    findUserById.mockResolvedValueOnce(
      baseUser({ requiresLocation: false, role: { requiresLocation: true } }),
    );

    await expect(getEffectiveRequiresLocation("user-1")).resolves.toBe(false);
  });

  it("falls back to the role default when there is no override", async () => {
    findUserById.mockResolvedValueOnce(
      baseUser({ requiresLocation: null, role: { requiresLocation: true } }),
    );

    await expect(getEffectiveRequiresLocation("user-1")).resolves.toBe(true);
  });

  it("throws when the user doesn't exist", async () => {
    findUserById.mockResolvedValueOnce(null);

    await expect(getEffectiveRequiresLocation("ghost")).rejects.toThrow(UserNotFoundError);
  });
});
