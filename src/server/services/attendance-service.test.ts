import { beforeEach, describe, expect, it, vi } from "vitest";

const findAttendanceWithSessions = vi.fn();
const upsertAttendanceDay = vi.fn();
const createSession = vi.fn();
const updateSession = vi.fn();
const findSessionsForUser = vi.fn();
vi.mock("@/server/repositories/attendance-repository", () => ({
  findAttendanceWithSessions,
  upsertAttendanceDay,
  createSession,
  updateSession,
  findSessionsForUser,
}));

const findUserById = vi.fn();
vi.mock("@/server/repositories/user-repository", () => ({ findUserById }));

const isWorkingDay = vi.fn();
vi.mock("@/server/services/working-day-service", () => ({ isWorkingDay }));

const {
  checkIn,
  checkOut,
  getEffectiveRequiresLocation,
  getTodayAttendanceState,
  listMySessions,
  UserNotFoundError,
  NotAWorkingDayError,
  AlreadyCheckedInError,
  NoCheckInFoundError,
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

const baseAttendanceDay = (overrides: Record<string, unknown> = {}) => ({
  id: "att-1",
  userId: "user-1",
  date: new Date("2026-10-01T00:00:00.000Z"),
  ...overrides,
});

const baseSession = (overrides: Record<string, unknown> = {}) => ({
  id: "session-1",
  attendanceId: "att-1",
  checkInAt: new Date("2026-10-01T08:00:00.000Z"),
  checkInLat: null,
  checkInLng: null,
  checkInAccuracy: null,
  checkOutAt: null,
  checkOutLat: null,
  checkOutLng: null,
  checkOutAccuracy: null,
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
  findAttendanceWithSessions.mockResolvedValue(null);
  upsertAttendanceDay.mockResolvedValue(baseAttendanceDay());
  createSession.mockResolvedValue(baseSession());
  updateSession.mockResolvedValue(
    baseSession({ checkOutAt: new Date("2026-10-01T17:00:00.000Z") }),
  );
  findSessionsForUser.mockResolvedValue({ items: [], total: 0 });
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
    expect(createSession).toHaveBeenCalled();
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
    expect(createSession).toHaveBeenCalled();
  });
});

describe("checkIn — location quality", () => {
  it("succeeds with a good-accuracy fix for a location-required user", async () => {
    findUserById.mockResolvedValueOnce(baseUser());

    await expect(checkIn("user-1", goodFix)).resolves.toBeDefined();
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({ checkInLat: goodFix.lat, checkInLng: goodFix.lng }),
    );
  });

  it("rejects a fix worse than the accuracy threshold", async () => {
    findUserById.mockResolvedValueOnce(baseUser());

    await expect(checkIn("user-1", { ...goodFix, accuracy: 500 })).rejects.toThrow(
      LocationAccuracyTooLowError,
    );
    expect(createSession).not.toHaveBeenCalled();
  });

  it("does not evaluate accuracy at all when no location was sent and none is required", async () => {
    findUserById.mockResolvedValueOnce(
      baseUser({ requiresLocation: false, role: { requiresLocation: false } }),
    );

    await expect(checkIn("user-1", {})).resolves.toBeDefined();
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({ checkInLat: undefined, checkInLng: undefined }),
    );
  });
});

describe("checkIn — guards and multi-session behavior", () => {
  it("rejects when a session is already open today", async () => {
    findUserById.mockResolvedValueOnce(
      baseUser({ requiresLocation: false, role: { requiresLocation: false } }),
    );
    findAttendanceWithSessions.mockResolvedValueOnce({
      ...baseAttendanceDay(),
      sessions: [baseSession()],
    });

    await expect(checkIn("user-1", {})).rejects.toThrow(AlreadyCheckedInError);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("allows a new session the same day once the previous one is closed", async () => {
    findUserById.mockResolvedValueOnce(
      baseUser({ requiresLocation: false, role: { requiresLocation: false } }),
    );
    findAttendanceWithSessions.mockResolvedValueOnce({
      ...baseAttendanceDay(),
      sessions: [
        baseSession({
          id: "session-1",
          checkOutAt: new Date("2026-10-01T12:00:00.000Z"),
        }),
      ],
    });

    await expect(checkIn("user-1", {})).resolves.toBeDefined();
    expect(createSession).toHaveBeenCalled();
    // Reuses the existing day row rather than creating a second one.
    expect(upsertAttendanceDay).not.toHaveBeenCalled();
  });

  it("creates today's day row only on the first session of the day", async () => {
    findUserById.mockResolvedValueOnce(
      baseUser({ requiresLocation: false, role: { requiresLocation: false } }),
    );
    findAttendanceWithSessions.mockResolvedValueOnce(null);

    await expect(checkIn("user-1", {})).resolves.toBeDefined();
    expect(upsertAttendanceDay).toHaveBeenCalledWith("user-1", expect.any(Date), "user-1");
  });

  it("rejects check-in on a non-working day", async () => {
    findUserById.mockResolvedValueOnce(
      baseUser({ requiresLocation: false, role: { requiresLocation: false } }),
    );
    isWorkingDay.mockResolvedValueOnce(false);

    await expect(checkIn("user-1", {})).rejects.toThrow(NotAWorkingDayError);
    expect(createSession).not.toHaveBeenCalled();
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

describe("checkOut — guards", () => {
  it("rejects when there's no open session, rather than creating an orphan row", async () => {
    findUserById.mockResolvedValueOnce(
      baseUser({ requiresLocation: false, role: { requiresLocation: false } }),
    );
    findAttendanceWithSessions.mockResolvedValueOnce(null);

    await expect(checkOut("user-1", {})).rejects.toThrow(NoCheckInFoundError);
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("rejects when today's only session is already closed", async () => {
    findUserById.mockResolvedValueOnce(
      baseUser({ requiresLocation: false, role: { requiresLocation: false } }),
    );
    findAttendanceWithSessions.mockResolvedValueOnce({
      ...baseAttendanceDay(),
      sessions: [baseSession({ checkOutAt: new Date("2026-10-01T12:00:00.000Z") })],
    });

    await expect(checkOut("user-1", {})).rejects.toThrow(NoCheckInFoundError);
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("throws when the user doesn't exist", async () => {
    findUserById.mockResolvedValueOnce(null);

    await expect(checkOut("ghost", {})).rejects.toThrow(UserNotFoundError);
  });
});

describe("checkOut — location requirement and quality", () => {
  it("requires location for a user whose role defaults to requiring it", async () => {
    findUserById.mockResolvedValueOnce(
      baseUser({ requiresLocation: null, role: { requiresLocation: true } }),
    );
    findAttendanceWithSessions.mockResolvedValueOnce({
      ...baseAttendanceDay(),
      sessions: [baseSession()],
    });

    await expect(checkOut("user-1", {})).rejects.toThrow(LocationRequiredError);
  });

  it("rejects a fix worse than the accuracy threshold, same as check-in", async () => {
    findUserById.mockResolvedValueOnce(baseUser());
    findAttendanceWithSessions.mockResolvedValueOnce({
      ...baseAttendanceDay(),
      sessions: [baseSession()],
    });

    await expect(checkOut("user-1", { ...goodFix, accuracy: 500 })).rejects.toThrow(
      LocationAccuracyTooLowError,
    );
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("succeeds with a good-accuracy fix for a location-required user, closing the open session", async () => {
    findUserById.mockResolvedValueOnce(baseUser());
    findAttendanceWithSessions.mockResolvedValueOnce({
      ...baseAttendanceDay(),
      sessions: [baseSession({ id: "session-7" })],
    });

    await expect(checkOut("user-1", goodFix)).resolves.toBeDefined();
    expect(updateSession).toHaveBeenCalledWith(
      "session-7",
      expect.objectContaining({ checkOutLat: goodFix.lat, checkOutLng: goodFix.lng }),
    );
  });
});

describe("checkOut — duration", () => {
  it("computes duration in minutes from the session's own checkInAt/checkOutAt", async () => {
    findUserById.mockResolvedValueOnce(
      baseUser({ requiresLocation: false, role: { requiresLocation: false } }),
    );
    findAttendanceWithSessions.mockResolvedValueOnce({
      ...baseAttendanceDay(),
      sessions: [baseSession({ checkInAt: new Date("2026-10-01T08:00:00.000Z") })],
    });
    updateSession.mockResolvedValueOnce(
      baseSession({
        checkInAt: new Date("2026-10-01T08:00:00.000Z"),
        checkOutAt: new Date("2026-10-01T17:30:00.000Z"),
      }),
    );

    const result = await checkOut("user-1", {});

    expect(result.durationMinutes).toBe(9 * 60 + 30);
  });
});

describe("getTodayAttendanceState", () => {
  it("returns not-checked-in with no latest session when nothing happened today", async () => {
    findAttendanceWithSessions.mockResolvedValueOnce(null);

    await expect(getTodayAttendanceState("user-1")).resolves.toEqual({
      status: "not-checked-in",
      latestSession: null,
      sessions: [],
    });
  });

  it("returns checked-in when the newest session has no checkOutAt", async () => {
    findAttendanceWithSessions.mockResolvedValueOnce({
      ...baseAttendanceDay(),
      sessions: [baseSession()],
    });

    const result = await getTodayAttendanceState("user-1");

    expect(result.status).toBe("checked-in");
    expect(result.latestSession?.id).toBe("session-1");
  });

  it("returns not-checked-in (but with a latest session) once the only session is closed", async () => {
    findAttendanceWithSessions.mockResolvedValueOnce({
      ...baseAttendanceDay(),
      sessions: [baseSession({ checkOutAt: new Date("2026-10-01T12:00:00.000Z") })],
    });

    const result = await getTodayAttendanceState("user-1");

    expect(result.status).toBe("not-checked-in");
    expect(result.latestSession?.checkOutAt).not.toBeNull();
  });

  it("reports checked-in when any session today is open, even if it isn't the newest in the list", async () => {
    findAttendanceWithSessions.mockResolvedValueOnce({
      ...baseAttendanceDay(),
      sessions: [
        baseSession({ id: "session-2", checkInAt: new Date("2026-10-01T14:00:00.000Z") }),
        baseSession({
          id: "session-1",
          checkInAt: new Date("2026-10-01T08:00:00.000Z"),
          checkOutAt: new Date("2026-10-01T12:00:00.000Z"),
        }),
      ],
    });

    const result = await getTodayAttendanceState("user-1");

    expect(result.status).toBe("checked-in");
  });
});

describe("listMySessions", () => {
  it("maps paged repository rows into session summaries", async () => {
    findSessionsForUser.mockResolvedValueOnce({
      items: [baseSession({ checkOutAt: new Date("2026-10-01T12:00:00.000Z") })],
      total: 1,
    });

    const result = await listMySessions("user-1", 1, 5);

    expect(result).toEqual({
      items: [expect.objectContaining({ id: "session-1", durationMinutes: 4 * 60 })],
      total: 1,
      page: 1,
      pageSize: 5,
    });
  });
});
