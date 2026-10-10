import { describe, expect, it } from "vitest";

import {
  addDays,
  currentAndUpcomingWeeks,
  parseDateOnly,
  rangesOverlap,
  startOfWeek,
  todayInKinshasa,
  weekContaining,
} from "./week";

const d = (iso: string) => parseDateOnly(iso);
const iso = (date: Date) => date.toISOString().slice(0, 10);

describe("todayInKinshasa", () => {
  it("is the same calendar day when it is the same day in both zones", () => {
    expect(iso(todayInKinshasa(new Date("2026-06-15T10:00:00.000Z")))).toBe("2026-06-15");
  });

  it("is already the next day in the last hour before UTC midnight (Kinshasa is UTC+1)", () => {
    expect(iso(todayInKinshasa(new Date("2026-06-15T23:30:00.000Z")))).toBe("2026-06-16");
  });

  it("returns UTC midnight, i.e. a pure calendar date", () => {
    expect(todayInKinshasa(new Date("2026-06-15T10:45:12.000Z")).toISOString()).toBe(
      "2026-06-15T00:00:00.000Z",
    );
  });
});

describe("weeks start on Monday", () => {
  it.each([
    ["2026-06-15", "2026-06-15"], // Monday
    ["2026-06-17", "2026-06-15"], // Wednesday
    ["2026-06-21", "2026-06-15"], // Sunday belongs to the week that began Monday
    ["2026-06-22", "2026-06-22"], // next Monday
  ])("%s is in the week starting %s", (date, monday) => {
    expect(iso(startOfWeek(d(date)))).toBe(monday);
  });

  it("a week is Monday to Sunday, seven days", () => {
    const week = weekContaining(d("2026-06-18"));
    expect(iso(week.start)).toBe("2026-06-15");
    expect(iso(week.end)).toBe("2026-06-21");
  });

  it("handles month and year boundaries", () => {
    expect(iso(startOfWeek(d("2027-01-01")))).toBe("2026-12-28");
    expect(iso(addDays(d("2026-02-27"), 3))).toBe("2026-03-02");
  });
});

describe("currentAndUpcomingWeeks", () => {
  it("returns this week and the single week after it", () => {
    const { thisWeek, upcomingWeek } = currentAndUpcomingWeeks(
      new Date("2026-06-17T09:00:00.000Z"),
    );
    expect([iso(thisWeek.start), iso(thisWeek.end)]).toEqual(["2026-06-15", "2026-06-21"]);
    expect([iso(upcomingWeek.start), iso(upcomingWeek.end)]).toEqual(["2026-06-22", "2026-06-28"]);
  });

  it("rolls over to the new week at midnight Kinshasa time, not UTC", () => {
    // Sunday 23:30 UTC is already Monday in Kinshasa.
    const { thisWeek } = currentAndUpcomingWeeks(new Date("2026-06-21T23:30:00.000Z"));
    expect(iso(thisWeek.start)).toBe("2026-06-22");
  });
});

describe("rangesOverlap", () => {
  const range = (a: string, b: string) => ({ start: d(a), end: d(b) });

  it("is inclusive on both ends", () => {
    expect(
      rangesOverlap(range("2026-06-10", "2026-06-15"), range("2026-06-15", "2026-06-21")),
    ).toBe(true);
    expect(
      rangesOverlap(range("2026-06-21", "2026-06-30"), range("2026-06-15", "2026-06-21")),
    ).toBe(true);
  });

  it("is false for ranges that only sit next to each other", () => {
    expect(
      rangesOverlap(range("2026-06-08", "2026-06-14"), range("2026-06-15", "2026-06-21")),
    ).toBe(false);
  });

  it("is true when one range contains the other", () => {
    expect(
      rangesOverlap(range("2026-06-01", "2026-07-31"), range("2026-06-15", "2026-06-21")),
    ).toBe(true);
  });
});
