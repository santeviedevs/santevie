import { describe, expect, it, vi } from "vitest";

const findLatestExchangeRate = vi.fn();
const insertExchangeRate = vi.fn();

vi.mock("@/server/repositories/exchange-rate-repository", () => ({
  findLatestExchangeRate,
  insertExchangeRate,
  listExchangeRateHistory: vi.fn(),
}));

const { getCurrentExchangeRate, setExchangeRate, convertToCdf } =
  await import("./exchange-rate-service");

describe("getCurrentExchangeRate", () => {
  it("returns null when no rate has ever been set", async () => {
    findLatestExchangeRate.mockResolvedValueOnce(null);
    await expect(getCurrentExchangeRate()).resolves.toBeNull();
  });

  it("returns the latest rate as a number", async () => {
    findLatestExchangeRate.mockResolvedValueOnce({
      id: "rate-1",
      rate: 2350,
      effectiveFrom: new Date("2026-09-15"),
    });
    await expect(getCurrentExchangeRate()).resolves.toEqual({
      id: "rate-1",
      rate: 2350,
      effectiveFrom: new Date("2026-09-15"),
    });
  });
});

describe("setExchangeRate", () => {
  // Every update inserts a new row rather than overwriting the last one —
  // this is what lets anything that already snapshotted a rate stay
  // unaffected by a later change.
  it("inserts a new row rather than updating the existing one", async () => {
    insertExchangeRate.mockResolvedValueOnce({
      id: "rate-2",
      rate: 2400,
      effectiveFrom: new Date("2026-09-22"),
    });

    await setExchangeRate({ rate: 2400 }, "actor-1");

    expect(insertExchangeRate).toHaveBeenCalledWith(
      expect.objectContaining({ rate: 2400, createdBy: "actor-1" }),
    );
  });
});

describe("convertToCdf", () => {
  it("multiplies the USD amount by the rate", () => {
    expect(convertToCdf(50, 2350)).toBe(117500);
  });
});
