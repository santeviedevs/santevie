import { describe, expect, it, vi } from "vitest";

const findManagerLinks = vi.fn();
const createUser = vi.fn();
const updateUser = vi.fn();

vi.mock("@/server/repositories/user-repository", () => ({
  findManagerLinks,
  createUser,
  updateUser,
  findUserById: vi.fn(),
  findUsers: vi.fn(),
  listRoleOptions: vi.fn(),
  listTerritoryOptions: vi.fn(),
  listManagerOptions: vi.fn(),
}));

vi.mock("@/server/auth/password", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed"),
}));

const {
  createUser: createUserService,
  updateUser: updateUserService,
  DuplicateEmployeeCodeError,
  DuplicateEmailError,
  ManagerCycleError,
  SelfManagerError,
} = await import("./user-service");

const baseUserRow = (overrides: Record<string, unknown> = {}) => ({
  id: "user-1",
  employeeCode: "EMP-1",
  name: "Test User",
  email: "test@example.com",
  status: "ACTIVE",
  role: { id: "role-1", name: "DELEGATE" },
  manager: null,
  homeTerritory: null,
  ...overrides,
});

const baseInput = {
  employeeCode: "EMP-2",
  name: "New User",
  email: "new@example.com",
  roleId: "role-1",
  managerId: null as string | null,
  homeTerritoryId: null as string | null,
};

describe("createUser", () => {
  it("assigns a manager without needing a cycle check, since a brand-new user can't be part of one yet", async () => {
    findManagerLinks.mockResolvedValueOnce([{ id: "mgr-1", managerId: null }]);
    createUser.mockResolvedValueOnce(baseUserRow());

    await expect(
      createUserService({ ...baseInput, managerId: "mgr-1" }, "actor-1"),
    ).resolves.toBeDefined();
    expect(createUser).toHaveBeenCalled();
  });

  it("maps a duplicate employeeCode constraint (array-form target) to DuplicateEmployeeCodeError", async () => {
    createUser.mockRejectedValueOnce({ code: "P2002", meta: { target: ["employeeCode"] } });

    await expect(createUserService(baseInput, "actor-1")).rejects.toThrow(
      DuplicateEmployeeCodeError,
    );
  });

  it("maps a duplicate employeeCode constraint reported by @prisma/adapter-pg to DuplicateEmployeeCodeError", async () => {
    // @prisma/adapter-pg doesn't populate meta.target at all — the
    // constraint name only shows up nested under the wrapped driver error.
    // This is the exact shape observed against a real Postgres instance,
    // and the shape that slipped through the original meta.target check.
    createUser.mockRejectedValueOnce({
      code: "P2002",
      meta: {
        driverAdapterError: {
          cause: { constraint: { index: "users_employeeCode_key" }, table: "users" },
        },
      },
    });

    await expect(createUserService(baseInput, "actor-1")).rejects.toThrow(
      DuplicateEmployeeCodeError,
    );
  });

  it("maps a duplicate employeeCode constraint using only the message when meta has no target", async () => {
    createUser.mockRejectedValueOnce({
      code: "P2002",
      message: "Unique constraint failed on the constraint: `users_employeeCode_key`",
    });

    await expect(createUserService(baseInput, "actor-1")).rejects.toThrow(
      DuplicateEmployeeCodeError,
    );
  });

  it("maps a duplicate email constraint to DuplicateEmailError", async () => {
    createUser.mockRejectedValueOnce({ code: "P2002", meta: { target: ["email"] } });

    await expect(createUserService(baseInput, "actor-1")).rejects.toThrow(DuplicateEmailError);
  });

  it("rethrows an unrelated error unchanged", async () => {
    createUser.mockRejectedValueOnce(new Error("connection lost"));

    await expect(createUserService(baseInput, "actor-1")).rejects.toThrow("connection lost");
  });
});

describe("updateUser", () => {
  it("rejects assigning a user as their own manager", async () => {
    await expect(
      updateUserService({ ...baseInput, id: "user-1", managerId: "user-1" }, "actor-1"),
    ).rejects.toThrow(SelfManagerError);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects a manager assignment that would create a reporting cycle", async () => {
    // user-1 manages user-2; assigning user-1's manager to user-2 would
    // create a two-node cycle.
    findManagerLinks.mockResolvedValueOnce([
      { id: "user-1", managerId: null },
      { id: "user-2", managerId: "user-1" },
    ]);

    await expect(
      updateUserService({ ...baseInput, id: "user-1", managerId: "user-2" }, "actor-1"),
    ).rejects.toThrow(ManagerCycleError);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("allows a manager assignment with no cycle", async () => {
    findManagerLinks.mockResolvedValueOnce([
      { id: "user-1", managerId: null },
      { id: "mgr-1", managerId: null },
    ]);
    updateUser.mockResolvedValueOnce(baseUserRow({ id: "user-1" }));

    await expect(
      updateUserService({ ...baseInput, id: "user-1", managerId: "mgr-1" }, "actor-1"),
    ).resolves.toBeDefined();
    expect(updateUser).toHaveBeenCalled();
  });
});
