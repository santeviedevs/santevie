import { describe, expect, it } from "vitest";

import { deriveAttendanceStatus } from "./attendance-status-service";

const thresholds = {
  expectedStartMinutes: 9 * 60,
  lateGraceMinutes: 15,
  minimumWorkedMinutes: 240,
};

// 08:00 UTC = 09:00 Africa/Kinshasa (fixed UTC+1) — exactly on time against
// the default thresholds above.
const onTimeCheckIn = new Date("2026-10-01T08:00:00.000Z");
const onTimeCheckOut = new Date("2026-10-01T13:00:00.000Z"); // 5h worked

function session(overrides: Record<string, unknown> = {}) {
  return {
    checkInAt: onTimeCheckIn,
    checkInAccuracy: 20,
    checkOutAt: onTimeCheckOut,
    checkOutAccuracy: 20,
    ...overrides,
  };
}

describe("deriveAttendanceStatus", () => {
  it("returns NON_WORKING for a holiday or approved leave, never ABSENT, even with no sessions", () => {
    expect(deriveAttendanceStatus({ sessions: [], isWorkingDay: false, thresholds })).toBe(
      "NON_WORKING",
    );
    expect(deriveAttendanceStatus({ sessions: [session()], isWorkingDay: false, thresholds })).toBe(
      "NON_WORKING",
    );
  });

  it("returns ABSENT for a working day with no session at all", () => {
    expect(deriveAttendanceStatus({ sessions: [], isWorkingDay: true, thresholds })).toBe("ABSENT");
  });

  it("returns NEEDS_REVIEW when a session's check-in fix accuracy is below threshold", () => {
    const result = deriveAttendanceStatus({
      sessions: [session({ checkInAccuracy: 999 })],
      isWorkingDay: true,
      thresholds,
    });
    expect(result).toBe("NEEDS_REVIEW");
  });

  it("returns NEEDS_REVIEW when a session's check-out fix accuracy is below threshold", () => {
    const result = deriveAttendanceStatus({
      sessions: [session({ checkOutAccuracy: 999 })],
      isWorkingDay: true,
      thresholds,
    });
    expect(result).toBe("NEEDS_REVIEW");
  });

  it("returns INCOMPLETE when a session has no check-out (missing checkout case)", () => {
    const result = deriveAttendanceStatus({
      sessions: [session({ checkOutAt: null, checkOutAccuracy: null })],
      isWorkingDay: true,
      thresholds,
    });
    expect(result).toBe("INCOMPLETE");
  });

  it("returns INCOMPLETE when total worked minutes fall under the configured minimum", () => {
    const shortCheckOut = new Date("2026-10-01T08:30:00.000Z"); // 30 min worked
    const result = deriveAttendanceStatus({
      sessions: [session({ checkOutAt: shortCheckOut })],
      isWorkingDay: true,
      thresholds,
    });
    expect(result).toBe("INCOMPLETE");
  });

  it("returns PRESENT for a full day checked in on time", () => {
    const result = deriveAttendanceStatus({
      sessions: [session()],
      isWorkingDay: true,
      thresholds,
    });
    expect(result).toBe("PRESENT");
  });

  it("returns LATE when the earliest check-in is after the grace cutoff", () => {
    const lateCheckIn = new Date("2026-10-01T08:30:00.000Z"); // 09:30 local, cutoff is 09:15
    const lateCheckOut = new Date("2026-10-01T13:30:00.000Z"); // still 5h worked
    const result = deriveAttendanceStatus({
      sessions: [session({ checkInAt: lateCheckIn, checkOutAt: lateCheckOut })],
      isWorkingDay: true,
      thresholds,
    });
    expect(result).toBe("LATE");
  });

  it("is idempotent — identical input always produces the same status", () => {
    const input = { sessions: [session()], isWorkingDay: true, thresholds };
    const first = deriveAttendanceStatus(input);
    const second = deriveAttendanceStatus(input);
    expect(first).toBe(second);
  });
});
