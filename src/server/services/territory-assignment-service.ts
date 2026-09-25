import type { AssignTerritoryInput } from "@/lib/schemas/territory-assignment";
import {
  createAssignment,
  deleteAssignment,
  findAssignmentById,
  listAssignmentsForUser,
  type TerritoryAssignmentRow,
} from "@/server/repositories/territory-assignment-repository";
import { findTerritoryById } from "@/server/repositories/territory-repository";

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

export type TerritoryAssignmentSummary = {
  id: string;
  territoryId: string;
  code: string;
  label: string;
};

function toSummary(row: TerritoryAssignmentRow): TerritoryAssignmentSummary {
  const t = row.territory;
  return {
    id: row.id,
    territoryId: t.id,
    code: t.code,
    label: [t.province.name, t.ville?.name, t.commune?.name, t.quartier?.name]
      .filter(Boolean)
      .join(" › "),
  };
}

export async function listTerritoryAssignments(
  userId: string,
): Promise<TerritoryAssignmentSummary[]> {
  const rows = await listAssignmentsForUser(userId);
  return rows.map(toSummary);
}

export async function assignTerritory(
  input: AssignTerritoryInput,
  actorId: string,
): Promise<TerritoryAssignmentSummary> {
  const territory = await findTerritoryById(input.territoryId);
  if (!territory) throw new TerritoryNotFoundError();
  if (territory.status === "INACTIVE") throw new InactiveTerritoryError();

  try {
    const row = await createAssignment({
      user: { connect: { id: input.userId } },
      territory: { connect: { id: input.territoryId } },
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
