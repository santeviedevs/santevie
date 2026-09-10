import type { CreateTerritoryInput, TerritoryFilters, UpdateTerritoryInput } from "@/lib/schemas/territory";
import {
  countActiveAssignments,
  createTerritory as createTerritoryRow,
  findTerritories,
  findTerritoryById,
  setTerritoryStatus,
  type TerritoryRow,
  updateTerritory as updateTerritoryRow,
} from "@/server/repositories/territory-repository";

export class DuplicateTerritoryCodeError extends Error {
  constructor() {
    super("A territory with this code already exists.");
    this.name = "DuplicateTerritoryCodeError";
  }
}

export class TerritoryInUseError extends Error {
  constructor(activeUsers: number, activeClients: number) {
    const parts = [
      activeUsers > 0 ? `${activeUsers} active user${activeUsers === 1 ? "" : "s"}` : null,
      activeClients > 0 ? `${activeClients} active client${activeClients === 1 ? "" : "s"}` : null,
    ].filter((part): part is string => part !== null);
    super(`Cannot deactivate: ${parts.join(" and ")} still assigned to this territory.`);
    this.name = "TerritoryInUseError";
  }
}

// The explicit shape returned to callers. A straight Prisma row happens to
// be safe to expose today, but mapping it keeps that an explicit choice
// rather than an accident that breaks the moment a sensitive column is added.
export type TerritorySummary = {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
};

function toSummary(territory: TerritoryRow): TerritorySummary {
  return {
    id: territory.id,
    code: territory.code,
    name: territory.name,
    status: territory.status,
  };
}

// Duck-typed rather than `instanceof Prisma.PrismaClientKnownRequestError` —
// see the identical note in user-service.ts: a custom generator output
// directory can put that class in more than one module instance across the
// server/action boundary, and instanceof silently fails across instances.
function isUniqueConstraintViolation(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

function mapUniqueConstraintError(error: unknown): never {
  if (isUniqueConstraintViolation(error)) {
    throw new DuplicateTerritoryCodeError();
  }
  throw error;
}

export async function listTerritories(filters: TerritoryFilters): Promise<TerritorySummary[]> {
  const territories = await findTerritories(filters);
  return territories.map(toSummary);
}

export async function getTerritory(id: string): Promise<TerritorySummary | null> {
  const territory = await findTerritoryById(id);
  return territory ? toSummary(territory) : null;
}

export async function createTerritory(
  input: CreateTerritoryInput,
  actorId: string,
): Promise<TerritorySummary> {
  try {
    const territory = await createTerritoryRow({
      code: input.code,
      name: input.name,
      createdBy: actorId,
      updatedBy: actorId,
    });
    return toSummary(territory);
  } catch (error) {
    mapUniqueConstraintError(error);
  }
}

export async function updateTerritory(
  input: UpdateTerritoryInput,
  actorId: string,
): Promise<TerritorySummary> {
  try {
    const territory = await updateTerritoryRow(input.id, {
      code: input.code,
      name: input.name,
      updatedBy: actorId,
    });
    return toSummary(territory);
  } catch (error) {
    mapUniqueConstraintError(error);
  }
}

export async function activateTerritory(id: string, actorId: string): Promise<TerritorySummary> {
  const territory = await setTerritoryStatus(id, "ACTIVE", actorId);
  return toSummary(territory);
}

export async function deactivateTerritory(
  id: string,
  actorId: string,
): Promise<TerritorySummary> {
  const { activeUsers, activeClients } = await countActiveAssignments(id);
  if (activeUsers > 0 || activeClients > 0) {
    throw new TerritoryInUseError(activeUsers, activeClients);
  }

  const territory = await setTerritoryStatus(id, "INACTIVE", actorId);
  return toSummary(territory);
}
