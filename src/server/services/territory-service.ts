import type {
  AncestorLevelInput,
  CreateTerritoryInput,
  TerritoryFilters,
  UpdateTerritoryInput,
} from "@/lib/schemas/territory";
import {
  countTerritories,
  countTerritoryDependents,
  createCommune as createCommuneRow,
  createProvince as createProvinceRow,
  createQuartier as createQuartierRow,
  createTerritoryRow,
  createVille as createVilleRow,
  findCommuneById,
  findProvinceById,
  findQuartierById,
  findTerritories,
  findTerritoryById,
  findTerritoryByPathKey,
  findVilleById,
  listActiveTerritories,
  type TerritoryRow,
  updateTerritoryRow,
} from "@/server/repositories/territory-repository";

export class DuplicateTerritoryNameError extends Error {
  constructor(level: string) {
    super(`A ${level} with this name already exists here.`);
    this.name = "DuplicateTerritoryNameError";
  }
}

// The combobox only offers ids it just fetched, but a stale form, a replayed
// request, or a hand-crafted one can still submit an id for the wrong
// parent — never trust it without checking, since that's the only thing
// standing between "existing" mode and creating data under the wrong branch
// of the hierarchy.
export class InvalidTerritoryHierarchyError extends Error {
  constructor(level: "ville" | "commune" | "quartier") {
    super(`The selected ${level} does not belong to the selected parent.`);
    this.name = "InvalidTerritoryHierarchyError";
  }
}

export class InactiveParentError extends Error {
  constructor(level: "ville" | "commune" | "quartier") {
    super(`Cannot use this ${level}: its parent is inactive.`);
    this.name = "InactiveParentError";
  }
}

// Thrown when re-pointing a Territory to a path that already belongs to a
// different Territory — the pathKey unique constraint is what actually
// enforces this, this just gives it a readable message.
export class DuplicateTerritoryPathError extends Error {
  constructor() {
    super("A territory for this exact Province/Ville/Commune/Quartier combination already exists.");
    this.name = "DuplicateTerritoryPathError";
  }
}

export class TerritoryInUseError extends Error {
  constructor(activeClients: number, activeUsers: number, activeAssignments: number) {
    const parts = [
      activeClients > 0 ? `${activeClients} active client${activeClients === 1 ? "" : "s"}` : null,
      activeUsers > 0 ? `${activeUsers} active user${activeUsers === 1 ? "" : "s"}` : null,
      activeAssignments > 0
        ? `${activeAssignments} territory assignment${activeAssignments === 1 ? "" : "s"}`
        : null,
    ].filter((part): part is string => part !== null);
    super(`Cannot deactivate: ${parts.join(" and ")} still assigned to this territory.`);
    this.name = "TerritoryInUseError";
  }
}

// Duck-typed rather than `instanceof Prisma.PrismaClientKnownRequestError` —
// a custom generator output directory can put that class in more than one
// module instance across the server/action boundary, and instanceof
// silently fails across instances.
function isUniqueConstraintViolation(
  error: unknown,
): error is { code: string; meta?: { target?: unknown } } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

function constraintTargets(error: { meta?: { target?: unknown } }, needle: string): boolean {
  const target = error.meta?.target;
  return typeof target === "string"
    ? target.includes(needle)
    : Array.isArray(target) && target.some((t) => String(t).includes(needle));
}

function mapGeographyUniqueError(level: string, error: unknown): never {
  if (isUniqueConstraintViolation(error)) throw new DuplicateTerritoryNameError(level);
  throw error;
}

export type TerritorySummary = {
  id: string;
  code: string;
  status: "ACTIVE" | "INACTIVE";
  province: { id: string; name: string };
  ville: { id: string; name: string } | null;
  commune: { id: string; name: string } | null;
  quartier: { id: string; name: string } | null;
};

function toSummary(row: TerritoryRow): TerritorySummary {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    province: row.province,
    ville: row.ville,
    commune: row.commune,
    quartier: row.quartier,
  };
}

export async function listTerritories(filters: TerritoryFilters): Promise<TerritorySummary[]> {
  const rows = await findTerritories(filters);
  return rows.map(toSummary);
}

export async function getTerritory(id: string): Promise<TerritorySummary | null> {
  const row = await findTerritoryById(id);
  return row ? toSummary(row) : null;
}

export type TerritoryOption = { id: string; code: string; label: string };

function toOption(row: TerritoryRow): TerritoryOption {
  return {
    id: row.id,
    code: row.code,
    label: [row.province.name, row.ville?.name, row.commune?.name, row.quartier?.name]
      .filter(Boolean)
      .join(" › "),
  };
}

// For the flat picker used by User/Client forms/filters and the
// assignment screen — a Territory is now a single pre-resolved unit to
// pick, not something to assemble level by level.
export async function listActiveTerritoryOptions(): Promise<TerritoryOption[]> {
  const rows = await listActiveTerritories();
  return rows.map(toOption);
}

// --- Resolving one geography level: pick an existing row, or create a new
// one by name under the given parent. A name colliding with an existing
// sibling surfaces as DuplicateTerritoryNameError. ---

async function resolveProvince(input: AncestorLevelInput, actorId: string): Promise<string> {
  if (input.mode === "existing") {
    const province = await findProvinceById(input.id);
    if (!province) throw new InvalidTerritoryHierarchyError("ville");
    if (province.status === "INACTIVE") throw new InactiveParentError("ville");
    return input.id;
  }
  try {
    const row = await createProvinceRow({
      name: input.name,
      createdBy: actorId,
      updatedBy: actorId,
    });
    return row.id;
  } catch (error) {
    mapGeographyUniqueError("province", error);
  }
}

async function resolveVille(
  input: AncestorLevelInput,
  provinceId: string,
  actorId: string,
): Promise<string> {
  if (input.mode === "existing") {
    const ville = await findVilleById(input.id);
    if (!ville || ville.provinceId !== provinceId)
      throw new InvalidTerritoryHierarchyError("ville");
    if (ville.status === "INACTIVE") throw new InactiveParentError("commune");
    return input.id;
  }
  try {
    const row = await createVilleRow({
      name: input.name,
      province: { connect: { id: provinceId } },
      createdBy: actorId,
      updatedBy: actorId,
    });
    return row.id;
  } catch (error) {
    mapGeographyUniqueError("ville", error);
  }
}

async function resolveCommune(
  input: AncestorLevelInput,
  villeId: string,
  actorId: string,
): Promise<string> {
  if (input.mode === "existing") {
    const commune = await findCommuneById(input.id);
    if (!commune || commune.villeId !== villeId)
      throw new InvalidTerritoryHierarchyError("commune");
    if (commune.status === "INACTIVE") throw new InactiveParentError("quartier");
    return input.id;
  }
  try {
    const row = await createCommuneRow({
      name: input.name,
      ville: { connect: { id: villeId } },
      createdBy: actorId,
      updatedBy: actorId,
    });
    return row.id;
  } catch (error) {
    mapGeographyUniqueError("commune", error);
  }
}

async function resolveQuartier(
  input: AncestorLevelInput,
  communeId: string,
  actorId: string,
): Promise<string> {
  if (input.mode === "existing") {
    const quartier = await findQuartierById(input.id);
    if (!quartier || quartier.communeId !== communeId) {
      throw new InvalidTerritoryHierarchyError("quartier");
    }
    return input.id;
  }
  try {
    const row = await createQuartierRow({
      name: input.name,
      commune: { connect: { id: communeId } },
      createdBy: actorId,
      updatedBy: actorId,
    });
    return row.id;
  } catch (error) {
    mapGeographyUniqueError("quartier", error);
  }
}

export type ResolvedPath = {
  provinceId: string;
  villeId: string | null;
  communeId: string | null;
  quartierId: string | null;
};

async function resolvePath(
  input: {
    province: AncestorLevelInput;
    ville?: AncestorLevelInput;
    commune?: AncestorLevelInput;
    quartier?: AncestorLevelInput;
  },
  actorId: string,
): Promise<ResolvedPath> {
  const provinceId = await resolveProvince(input.province, actorId);
  let villeId: string | null = null;
  let communeId: string | null = null;
  let quartierId: string | null = null;

  if (input.ville) {
    villeId = await resolveVille(input.ville, provinceId, actorId);
    if (input.commune) {
      communeId = await resolveCommune(input.commune, villeId, actorId);
      if (input.quartier) {
        quartierId = await resolveQuartier(input.quartier, communeId, actorId);
      }
    }
  }

  return { provinceId, villeId, communeId, quartierId };
}

function buildPathKey(path: ResolvedPath): string {
  return [path.provinceId, path.villeId ?? "-", path.communeId ?? "-", path.quartierId ?? "-"].join(
    ":",
  );
}

function formatCode(n: number): string {
  return `TER-${String(n).padStart(5, "0")}`;
}

// Matches an existing Territory for this exact path, or creates one with
// the next sequential code — the "same combination = same Territory" rule
// confirmed for S2-05's revised design. Retries the code on a rare
// concurrent-write collision; falls back to the existing row if two
// requests raced to create the same path.
// Exported for the territory importer (S2-05), which resolves geography by
// name (not the pick-or-create combobox shape) but shares this exact
// find-or-create-by-path step once a path is resolved.
export async function findOrCreateTerritory(
  path: ResolvedPath,
  actorId: string,
): Promise<{ territory: TerritoryRow; created: boolean }> {
  const pathKey = buildPathKey(path);
  const existing = await findTerritoryByPathKey(pathKey);
  if (existing) return { territory: existing, created: false };

  let attempt = (await countTerritories()) + 1;
  for (let tries = 0; tries < 5; tries++) {
    try {
      const created = await createTerritoryRow({
        code: formatCode(attempt),
        province: { connect: { id: path.provinceId } },
        ville: path.villeId ? { connect: { id: path.villeId } } : undefined,
        commune: path.communeId ? { connect: { id: path.communeId } } : undefined,
        quartier: path.quartierId ? { connect: { id: path.quartierId } } : undefined,
        pathKey,
        createdBy: actorId,
        updatedBy: actorId,
      });
      return { territory: created, created: true };
    } catch (error) {
      if (isUniqueConstraintViolation(error) && constraintTargets(error, "code")) {
        attempt += 1;
        continue;
      }
      if (isUniqueConstraintViolation(error) && constraintTargets(error, "pathKey")) {
        const raced = await findTerritoryByPathKey(pathKey);
        if (raced) return { territory: raced, created: false };
      }
      throw error;
    }
  }
  throw new Error("Could not generate a unique territory code.");
}

export async function createTerritory(
  input: CreateTerritoryInput,
  actorId: string,
): Promise<TerritorySummary> {
  const path = await resolvePath(input, actorId);
  const { territory } = await findOrCreateTerritory(path, actorId);
  return toSummary(territory);
}

// Re-points an existing Territory to a (possibly different) path, and/or
// toggles its own status. Deactivating checks this Territory's own direct
// dependents only — Territory has no descendants of its own to cascade
// into, unlike the old geography-row model.
export async function updateTerritoryEntry(
  input: UpdateTerritoryInput,
  actorId: string,
): Promise<TerritorySummary> {
  const path = await resolvePath(input, actorId);
  const pathKey = buildPathKey(path);

  if (input.status === "INACTIVE") {
    const { activeClients, activeUsers, activeAssignments } = await countTerritoryDependents(
      input.id,
    );
    if (activeClients > 0 || activeUsers > 0 || activeAssignments > 0) {
      throw new TerritoryInUseError(activeClients, activeUsers, activeAssignments);
    }
  }

  try {
    const updated = await updateTerritoryRow(input.id, {
      province: { connect: { id: path.provinceId } },
      ville: path.villeId ? { connect: { id: path.villeId } } : { disconnect: true },
      commune: path.communeId ? { connect: { id: path.communeId } } : { disconnect: true },
      quartier: path.quartierId ? { connect: { id: path.quartierId } } : { disconnect: true },
      pathKey,
      ...(input.status ? { status: input.status } : {}),
      updatedBy: actorId,
    });
    return toSummary(updated);
  } catch (error) {
    if (isUniqueConstraintViolation(error) && constraintTargets(error, "pathKey")) {
      throw new DuplicateTerritoryPathError();
    }
    throw error;
  }
}
