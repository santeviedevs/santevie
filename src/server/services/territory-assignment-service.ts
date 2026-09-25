import type { AssignTerritoryInput } from "@/lib/schemas/territory-assignment";
import {
  createAssignment,
  deleteAssignment,
  findAssignmentById,
  listAssignmentsForUser,
  type TerritoryAssignmentRow,
} from "@/server/repositories/territory-assignment-repository";
import { findTerritoryEntryById } from "@/server/repositories/territory-repository";

export class TerritoryNotFoundError extends Error {
  constructor() {
    super("The selected territory could not be found.");
    this.name = "TerritoryNotFoundError";
  }
}

export class InactiveTerritoryError extends Error {
  constructor() {
    super("Cannot assign an inactive territory.");
    this.name = "InactiveTerritoryError";
  }
}

export class DuplicateAssignmentError extends Error {
  constructor() {
    super("This territory is already assigned to this user.");
    this.name = "DuplicateAssignmentError";
  }
}

export class AssignmentNotFoundError extends Error {
  constructor() {
    super("This assignment no longer exists.");
    this.name = "AssignmentNotFoundError";
  }
}

// Duck-typed rather than `instanceof Prisma.PrismaClientKnownRequestError` —
// same reasoning as the identical helper in user-service.ts and
// territory-service.ts: a custom generator output directory can put that
// class in more than one module instance across the server/action
// boundary, and instanceof silently fails across instances.
function isUniqueConstraintViolation(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

export type AssignmentLevel = "province" | "ville" | "commune" | "quartier";

export type TerritoryAssignmentSummary = {
  id: string;
  level: AssignmentLevel;
  name: string;
};

function toSummary(row: TerritoryAssignmentRow): TerritoryAssignmentSummary {
  if (row.quartier) return { id: row.id, level: "quartier", name: row.quartier.name };
  if (row.commune) return { id: row.id, level: "commune", name: row.commune.name };
  if (row.ville) return { id: row.id, level: "ville", name: row.ville.name };
  return { id: row.id, level: "province", name: row.province?.name ?? "" };
}

export async function listTerritoryAssignments(
  userId: string,
): Promise<TerritoryAssignmentSummary[]> {
  const rows = await listAssignmentsForUser(userId);
  return rows.map(toSummary);
}

// The input carries every ancestor level above whichever one the admin
// picked (CascadingTerritoryFields' natural shape — see the schema
// comment), but only the deepest is the actual assignment target. Ancestor
// ids are read here only to find that target; they're never persisted on
// the created row (see the model comment in schema.prisma for why).
function deepestTarget(input: AssignTerritoryInput): { level: AssignmentLevel; id: string } | null {
  if (input.quartierId) return { level: "quartier", id: input.quartierId };
  if (input.communeId) return { level: "commune", id: input.communeId };
  if (input.villeId) return { level: "ville", id: input.villeId };
  if (input.provinceId) return { level: "province", id: input.provinceId };
  return null;
}

export async function assignTerritory(
  input: AssignTerritoryInput,
  actorId: string,
): Promise<TerritoryAssignmentSummary> {
  const target = deepestTarget(input);
  if (!target) throw new TerritoryNotFoundError();

  const entry = await findTerritoryEntryById(target.id);
  if (!entry || entry.level !== target.level) throw new TerritoryNotFoundError();
  if (entry.row.status === "INACTIVE") throw new InactiveTerritoryError();

  try {
    const row = await createAssignment({
      user: { connect: { id: input.userId } },
      ...(target.level === "province" ? { province: { connect: { id: target.id } } } : {}),
      ...(target.level === "ville" ? { ville: { connect: { id: target.id } } } : {}),
      ...(target.level === "commune" ? { commune: { connect: { id: target.id } } } : {}),
      ...(target.level === "quartier" ? { quartier: { connect: { id: target.id } } } : {}),
      createdBy: actorId,
      updatedBy: actorId,
    });
    return toSummary(row);
  } catch (error) {
    if (isUniqueConstraintViolation(error)) throw new DuplicateAssignmentError();
    throw error;
  }
}

export async function removeTerritoryAssignment(id: string): Promise<void> {
  const existing = await findAssignmentById(id);
  if (!existing) throw new AssignmentNotFoundError();
  await deleteAssignment(id);
}
