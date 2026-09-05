import { describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@/server/auth", () => ({ auth }));

const { ForbiddenError, requirePermission } = await import("./require-permission");

describe("requirePermission", () => {
  it("throws ForbiddenError when there is no session", async () => {
    auth.mockResolvedValueOnce(null);

    await expect(requirePermission("orders:approve")).rejects.toThrow(ForbiddenError);
  });

  it("throws ForbiddenError when the session lacks the permission", async () => {
    auth.mockResolvedValueOnce({ user: { permissions: ["orders:view-own"] } });

    await expect(requirePermission("orders:approve")).rejects.toThrow(ForbiddenError);
  });

  it("returns the session when the permission is present", async () => {
    const session = { user: { permissions: ["orders:approve"] } };
    auth.mockResolvedValueOnce(session);

    await expect(requirePermission("orders:approve")).resolves.toBe(session);
  });
});
