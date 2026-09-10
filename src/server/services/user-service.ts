import { randomUUID } from "node:crypto";

import type { CreateUserInput, UpdateUserInput, UserFilters } from "@/lib/schemas/user";
import { hashPassword } from "@/server/auth/password";
import {
  createUser as createUserRow,
  findManagerLinks,
  findUserById,
  findUsers,
  listManagerOptions,
  listRoleOptions,
  listTerritoryOptions,
  updateUser as updateUserRow,
  type UserWithRelations,
} from "@/server/repositories/user-repository";
import { type Scope, scopeUserIds } from "@/server/scope";

export class DuplicateEmployeeCodeError extends Error {
  constructor() {
    super("An employee with this code already exists.");
    this.name = "DuplicateEmployeeCodeError";
  }
}

export class DuplicateEmailError extends Error {
  constructor() {
    super("An employee with this email already exists.");
    this.name = "DuplicateEmailError";
  }
}

export class ManagerCycleError extends Error {
  constructor() {
    super("This manager assignment would create a reporting cycle.");
    this.name = "ManagerCycleError";
  }
}

export class SelfManagerError extends Error {
  constructor() {
    super("A user cannot be their own manager.");
    this.name = "SelfManagerError";
  }
}

// The explicit shape returned to callers (and ultimately the client). Never
// pass a Prisma row straight through — this keeps passwordHash out and makes
// a later column addition opt-in rather than automatically exposed.
export type UserSummary = {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  status: "ACTIVE" | "INACTIVE";
  role: { id: string; name: string };
  manager: { id: string; name: string } | null;
  homeTerritory: { id: string; name: string } | null;
};

function toSummary(user: UserWithRelations): UserSummary {
  return {
    id: user.id,
    employeeCode: user.employeeCode,
    name: user.name,
    email: user.email,
    status: user.status,
    role: { id: user.role.id, name: user.role.name },
    manager: user.manager ? { id: user.manager.id, name: user.manager.name } : null,
    homeTerritory: user.homeTerritory
      ? { id: user.homeTerritory.id, name: user.homeTerritory.name }
      : null,
  };
}

export async function listUsers(filters: UserFilters, scope: Scope): Promise<UserSummary[]> {
  const users = await findUsers(filters, scopeUserIds(scope));
  return users.map(toSummary);
}

// Returns null both when the id doesn't exist and when it exists but falls
// outside the caller's scope — the two must be indistinguishable to the
// caller, or the response itself would leak which ids exist outside a
// supervisor's team.
export async function getUser(id: string, scope: Scope): Promise<UserSummary | null> {
  const user = await findUserById(id, scopeUserIds(scope));
  return user ? toSummary(user) : null;
}

export async function getUserFormOptions(excludeUserId?: string) {
  const [roles, territories, managers] = await Promise.all([
    listRoleOptions(),
    listTerritoryOptions(),
    listManagerOptions(excludeUserId),
  ]);
  return { roles, territories, managers };
}

// Walks the manager chain in memory (one query for the whole table, see the
// repository) to reject an assignment that would make `candidateManagerId`
// a report of `userId`, directly or transitively.
async function assertNoManagerCycle(userId: string | null, candidateManagerId: string) {
  if (userId && candidateManagerId === userId) {
    throw new SelfManagerError();
  }

  const links = await findManagerLinks();
  const managerOf = new Map(links.map((link) => [link.id, link.managerId]));

  let current: string | null = candidateManagerId;
  const seen = new Set<string>();
  while (current) {
    if (userId && current === userId) {
      throw new ManagerCycleError();
    }
    if (seen.has(current)) break;
    seen.add(current);
    current = managerOf.get(current) ?? null;
  }
}

// Duck-typed rather than `instanceof Prisma.PrismaClientKnownRequestError`:
// with a custom generator output directory, Next.js can bundle that class
// into more than one module instance across the server/action boundary, and
// instanceof silently fails across instances, letting the raw Prisma error
// escape uncaught.
type PrismaKnownRequestErrorLike = {
  code: string;
  message?: string;
  meta?: {
    // Classic query-engine shape: an array (or occasionally a single
    // string) of the offending column name(s).
    target?: string | string[];
    // @prisma/adapter-pg's shape instead: the underlying pg error only
    // carries the constraint name, nested under the driver error it wraps.
    driverAdapterError?: {
      cause?: { constraint?: { index?: string }; table?: string };
    };
  };
};

function isUniqueConstraintViolation(error: unknown): error is PrismaKnownRequestErrorLike {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

function mapUniqueConstraintError(error: unknown): never {
  if (isUniqueConstraintViolation(error)) {
    const target = error.meta?.target;
    const constraintIndex = error.meta?.driverAdapterError?.cause?.constraint?.index;
    // The rendered message always names the constraint too (e.g. "Unique
    // constraint failed on the constraint: `users_employeeCode_key`"), so
    // it's included as a last-resort fallback independent of meta's shape.
    const haystack = [
      Array.isArray(target) ? target.join(" ") : target,
      constraintIndex,
      error.message,
    ]
      .filter(Boolean)
      .join(" ");

    if (haystack.includes("employeeCode")) throw new DuplicateEmployeeCodeError();
    if (haystack.includes("email")) throw new DuplicateEmailError();
  }
  throw error;
}

export async function createUser(input: CreateUserInput, actorId: string): Promise<UserSummary> {
  if (input.managerId) {
    await assertNoManagerCycle(null, input.managerId);
  }

  try {
    const user = await createUserRow({
      employeeCode: input.employeeCode,
      name: input.name,
      email: input.email.toLowerCase(),
      // A hash of a random, never-revealed value: a valid bcrypt hash so
      // verifyPassword never errors on it, but one no real password can
      // ever match. Setting a real password is a later story (invite /
      // first-login reset); this just keeps the column non-null until then.
      passwordHash: await hashPassword(randomUUID()),
      status: "ACTIVE",
      role: { connect: { id: input.roleId } },
      manager: input.managerId ? { connect: { id: input.managerId } } : undefined,
      homeTerritory: input.homeTerritoryId ? { connect: { id: input.homeTerritoryId } } : undefined,
      createdBy: actorId,
      updatedBy: actorId,
    });
    return toSummary(user);
  } catch (error) {
    mapUniqueConstraintError(error);
  }
}

export async function updateUser(input: UpdateUserInput, actorId: string): Promise<UserSummary> {
  if (input.managerId) {
    await assertNoManagerCycle(input.id, input.managerId);
  }

  try {
    const user = await updateUserRow(input.id, {
      employeeCode: input.employeeCode,
      name: input.name,
      email: input.email.toLowerCase(),
      role: { connect: { id: input.roleId } },
      manager: input.managerId ? { connect: { id: input.managerId } } : { disconnect: true },
      homeTerritory: input.homeTerritoryId
        ? { connect: { id: input.homeTerritoryId } }
        : { disconnect: true },
      updatedBy: actorId,
    });
    return toSummary(user);
  } catch (error) {
    mapUniqueConstraintError(error);
  }
}

export async function deactivateUser(id: string, actorId: string): Promise<UserSummary> {
  const user = await updateUserRow(id, { status: "INACTIVE", updatedBy: actorId });
  return toSummary(user);
}
