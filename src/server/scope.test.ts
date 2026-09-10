import { describe, expect, it, vi } from "vitest";

const findManagerLinks = vi.fn();

vi.mock("@/server/repositories/user-repository", () => ({
  findManagerLinks,
}));

const { getDownstreamUserIds, getUserScope, isWithinScope, scopeUserIds } = await import("./scope");

describe("getDownstreamUserIds", () => {
  it("resolves the full downstream team, several levels deep", async () => {
    // top -> mid -> leaf-1, leaf-2, plus an unrelated user elsewhere in the org.
    findManagerLinks.mockResolvedValueOnce([
      { id: "top", managerId: null },
      { id: "mid", managerId: "top" },
      { id: "leaf-1", managerId: "mid" },
      { id: "leaf-2", managerId: "mid" },
      { id: "other-team-lead", managerId: null },
      { id: "other-team-member", managerId: "other-team-lead" },
    ]);

    const downstream = await getDownstreamUserIds("top");

    expect(downstream).toEqual(expect.arrayContaining(["mid", "leaf-1", "leaf-2"]));
    expect(downstream).not.toContain("other-team-lead");
    expect(downstream).not.toContain("other-team-member");
    expect(downstream).toHaveLength(3);
  });

  it("returns an empty list for a user with no reports", async () => {
    findManagerLinks.mockResolvedValueOnce([{ id: "solo", managerId: null }]);

    await expect(getDownstreamUserIds("solo")).resolves.toEqual([]);
  });
});

describe("getUserScope", () => {
  it("gives ADMIN unrestricted access", async () => {
    findManagerLinks.mockClear();
    await expect(getUserScope({ user: { id: "admin-1", roleName: "ADMIN" } })).resolves.toEqual({
      kind: "all",
    });
    expect(findManagerLinks).not.toHaveBeenCalled();
  });

  it("gives MANAGER unrestricted access", async () => {
    await expect(getUserScope({ user: { id: "mgr-1", roleName: "MANAGER" } })).resolves.toEqual({
      kind: "all",
    });
  });

  it("scopes SUPERVISOR to themselves plus their downstream team", async () => {
    findManagerLinks.mockResolvedValueOnce([
      { id: "sup-1", managerId: null },
      { id: "report-1", managerId: "sup-1" },
    ]);

    await expect(getUserScope({ user: { id: "sup-1", roleName: "SUPERVISOR" } })).resolves.toEqual({
      kind: "ids",
      userIds: ["sup-1", "report-1"],
    });
  });

  it("scopes DELEGATE to only themselves", async () => {
    findManagerLinks.mockClear();
    await expect(getUserScope({ user: { id: "del-1", roleName: "DELEGATE" } })).resolves.toEqual({
      kind: "ids",
      userIds: ["del-1"],
    });
    expect(findManagerLinks).not.toHaveBeenCalled();
  });
});

describe("scopeUserIds", () => {
  it("returns undefined (no filter) for an unrestricted scope", () => {
    expect(scopeUserIds({ kind: "all" })).toBeUndefined();
  });

  it("returns the id list for a restricted scope", () => {
    expect(scopeUserIds({ kind: "ids", userIds: ["a", "b"] })).toEqual(["a", "b"]);
  });
});

describe("isWithinScope", () => {
  it("is always true for an unrestricted scope", () => {
    expect(isWithinScope({ kind: "all" }, "anyone")).toBe(true);
  });

  it("is true only for ids inside a restricted scope", () => {
    const scope = { kind: "ids" as const, userIds: ["a", "b"] };
    expect(isWithinScope(scope, "a")).toBe(true);
    expect(isWithinScope(scope, "c")).toBe(false);
  });
});
