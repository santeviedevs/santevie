import type {
  AncestorLevelInput,
  CreateTerritoryInput,
  TerritoryFilters,
  TerritoryLevel,
  UpdateTerritoryInput,
} from "@/lib/schemas/territory";
import {
  cascadeDeactivateCommune,
  cascadeDeactivateProvince,
  cascadeDeactivateVille,
  type CommuneWithAncestryRow,
  countActiveDependents,
  countQuartierDependents,
  createCommune as createCommuneRow,
  createProvince as createProvinceRow,
  createQuartier as createQuartierRow,
  createVille as createVilleRow,
  findCommuneById,
  findCommunes,
  findProvinceById,
  findProvinces,
  findQuartiers,
  findTerritoryEntryById,
  findVilleById,
  findVilles,
  getCommuneDescendantIds,
  getProvinceDescendantIds,
  getVilleDescendantIds,
  type QuartierRow,
  setCommuneStatus,
  setProvinceStatus,
  setQuartierStatus,
  setVilleStatus,
  type TerritoryEntryRow,
  updateCommune as updateCommuneRow,
  updateProvince as updateProvinceRow,
  updateQuartier as updateQuartierRow,
  updateVille as updateVilleRow,
  type VilleWithProvinceRow,
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
  constructor(level: "ville" | "commune") {
    super(`The selected ${level} does not belong to the selected parent.`);
    this.name = "InvalidTerritoryHierarchyError";
  }
}

// Activation never cascades (see activateProvince/activateVille/
// activateCommune/activateQuartier below), so it's the only place an
// inactive-parent/active-child state could otherwise be created —
// reactivating a row whose direct parent is still inactive.
export class InactiveParentError extends Error {
  constructor(level: "ville" | "commune" | "quartier") {
    super(`Cannot activate: the parent of this ${level} is inactive.`);
    this.name = "InactiveParentError";
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

function mapUniqueConstraintError(level: string, error: unknown): never {
  if (isUniqueConstraintViolation(error)) {
    throw new DuplicateTerritoryNameError(level);
  }
  throw error;
}

// A Territory is now whichever of Province/Ville/Commune/Quartier an admin
// stopped at — `level` says which, and `province`/`ville`/`commune` carry
// only the ancestry *above* that level (null at or below it).
export type TerritoryEntry = {
  id: string;
  level: TerritoryLevel;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  province: { id: string; name: string } | null;
  ville: { id: string; name: string } | null;
  commune: { id: string; name: string } | null;
};

function toTerritoryEntry(entry: TerritoryEntryRow): TerritoryEntry {
  const { level, row } = entry;
  if (level === "province") {
    return {
      id: row.id,
      level,
      name: row.name,
      status: row.status,
      province: null,
      ville: null,
      commune: null,
    };
  }
  if (level === "ville") {
    const v = row as VilleWithProvinceRow;
    return {
      id: v.id,
      level,
      name: v.name,
      status: v.status,
      province: { id: v.province.id, name: v.province.name },
      ville: null,
      commune: null,
    };
  }
  if (level === "commune") {
    const c = row as CommuneWithAncestryRow;
    return {
      id: c.id,
      level,
      name: c.name,
      status: c.status,
      province: { id: c.ville.province.id, name: c.ville.province.name },
      ville: { id: c.ville.id, name: c.ville.name },
      commune: null,
    };
  }
  const q = row as QuartierRow;
  return {
    id: q.id,
    level: "quartier",
    name: q.name,
    status: q.status,
    province: { id: q.commune.ville.province.id, name: q.commune.ville.province.name },
    ville: { id: q.commune.ville.id, name: q.commune.ville.name },
    commune: { id: q.commune.id, name: q.commune.name },
  };
}

export async function listTerritoryEntries(filters: TerritoryFilters): Promise<TerritoryEntry[]> {
  // A `villeId`/`communeId` filter narrows to that level or deeper —
  // shallower levels can never match it, so skip querying them entirely.
  const includeProvinces = !filters.villeId && !filters.communeId;
  const includeVilles = !filters.communeId;

  const [provinces, villes, communes, quartiers] = await Promise.all([
    includeProvinces ? findProvinces(filters) : Promise.resolve([]),
    includeVilles ? findVilles(filters) : Promise.resolve([]),
    findCommunes(filters),
    findQuartiers(filters),
  ]);

  const entries = [
    ...provinces.map((row) => toTerritoryEntry({ level: "province" as const, row })),
    ...villes.map((row) => toTerritoryEntry({ level: "ville" as const, row })),
    ...communes.map((row) => toTerritoryEntry({ level: "commune" as const, row })),
    ...quartiers.map((row) => toTerritoryEntry({ level: "quartier" as const, row })),
  ];
  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries;
}

export async function getTerritoryEntry(id: string): Promise<TerritoryEntry | null> {
  const entry = await findTerritoryEntryById(id);
  return entry ? toTerritoryEntry(entry) : null;
}

// --- Province/Ville/Commune/Quartier status ---
//
// Activation only ever touches the single row — descendants keep whatever
// status they already had, since silently reactivating a subtree nobody
// asked to reactivate would be surprising and unsafe. Deactivation is the
// opposite: it must reach every descendant, since an inactive parent can
// never be left with an active child.

export async function activateProvince(id: string, actorId: string): Promise<void> {
  await setProvinceStatus(id, "ACTIVE", actorId);
}

// Read-only half of deactivateProvince, split out so updateProvinceEntry can
// fail fast — before renaming anything — when an edit tries to both rename
// and deactivate a Province in the same request. Returns the descendant ids
// so a subsequent deactivateProvince call doesn't have to look them up
// again.
async function assertProvinceCanDeactivate(
  id: string,
): Promise<{ villeIds: string[]; communeIds: string[]; quartierIds: string[] }> {
  const descendants = await getProvinceDescendantIds(id);
  const { activeClients, activeUsers, activeAssignments } = await countActiveDependents({
    provinceIds: [id],
    ...descendants,
  });
  if (activeClients > 0 || activeUsers > 0 || activeAssignments > 0) {
    throw new TerritoryInUseError(activeClients, activeUsers, activeAssignments);
  }
  return descendants;
}

export async function deactivateProvince(id: string, actorId: string): Promise<void> {
  const descendants = await assertProvinceCanDeactivate(id);
  await cascadeDeactivateProvince(id, descendants, actorId);
}

export async function activateVille(id: string, actorId: string): Promise<void> {
  const ville = await findVilleById(id);
  const province = ville ? await findProvinceById(ville.provinceId) : null;
  if (province?.status === "INACTIVE") {
    throw new InactiveParentError("ville");
  }
  await setVilleStatus(id, "ACTIVE", actorId);
}

async function assertVilleCanDeactivate(
  id: string,
): Promise<{ communeIds: string[]; quartierIds: string[] }> {
  const descendants = await getVilleDescendantIds(id);
  const { activeClients, activeUsers, activeAssignments } = await countActiveDependents({
    villeIds: [id],
    ...descendants,
  });
  if (activeClients > 0 || activeUsers > 0 || activeAssignments > 0) {
    throw new TerritoryInUseError(activeClients, activeUsers, activeAssignments);
  }
  return descendants;
}

export async function deactivateVille(id: string, actorId: string): Promise<void> {
  const descendants = await assertVilleCanDeactivate(id);
  await cascadeDeactivateVille(id, descendants, actorId);
}

export async function activateCommune(id: string, actorId: string): Promise<void> {
  const commune = await findCommuneById(id);
  const ville = commune ? await findVilleById(commune.villeId) : null;
  if (ville?.status === "INACTIVE") {
    throw new InactiveParentError("commune");
  }
  await setCommuneStatus(id, "ACTIVE", actorId);
}

async function assertCommuneCanDeactivate(id: string): Promise<{ quartierIds: string[] }> {
  const descendants = await getCommuneDescendantIds(id);
  const { activeClients, activeUsers, activeAssignments } = await countActiveDependents({
    communeIds: [id],
    ...descendants,
  });
  if (activeClients > 0 || activeUsers > 0 || activeAssignments > 0) {
    throw new TerritoryInUseError(activeClients, activeUsers, activeAssignments);
  }
  return descendants;
}

export async function deactivateCommune(id: string, actorId: string): Promise<void> {
  const descendants = await assertCommuneCanDeactivate(id);
  await cascadeDeactivateCommune(id, descendants, actorId);
}

export async function activateQuartier(id: string, actorId: string): Promise<void> {
  const entry = await findTerritoryEntryById(id);
  if (entry?.level === "quartier" && entry.row.commune.status === "INACTIVE") {
    throw new InactiveParentError("quartier");
  }
  await setQuartierStatus(id, "ACTIVE", actorId);
}

async function assertQuartierCanDeactivate(id: string): Promise<void> {
  const { activeClients, activeUsers, activeAssignments } = await countQuartierDependents(id);
  if (activeClients > 0 || activeUsers > 0 || activeAssignments > 0) {
    throw new TerritoryInUseError(activeClients, activeUsers, activeAssignments);
  }
}

export async function deactivateQuartier(id: string, actorId: string): Promise<void> {
  await assertQuartierCanDeactivate(id);
  await setQuartierStatus(id, "INACTIVE", actorId);
}

// Resolves one ancestor level to an id — either the id the caller already
// picked (an existing Province/Ville/Commune), or a freshly created row
// under the given parent. A name colliding with an existing sibling
// surfaces as DuplicateTerritoryNameError, telling the admin to pick the
// existing one instead of guessing why the save failed.
async function resolveProvince(input: AncestorLevelInput, actorId: string): Promise<string> {
  if (input.mode === "existing") return input.id;
  try {
    const row = await createProvinceRow({
      name: input.name,
      createdBy: actorId,
      updatedBy: actorId,
    });
    return row.id;
  } catch (error) {
    mapUniqueConstraintError("province", error);
  }
}

async function resolveVille(
  input: AncestorLevelInput,
  provinceId: string,
  actorId: string,
): Promise<string> {
  if (input.mode === "existing") {
    const ville = await findVilleById(input.id);
    if (!ville || ville.provinceId !== provinceId) {
      throw new InvalidTerritoryHierarchyError("ville");
    }
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
    mapUniqueConstraintError("ville", error);
  }
}

async function resolveCommune(
  input: AncestorLevelInput,
  villeId: string,
  actorId: string,
): Promise<string> {
  if (input.mode === "existing") {
    const commune = await findCommuneById(input.id);
    if (!commune || commune.villeId !== villeId) {
      throw new InvalidTerritoryHierarchyError("commune");
    }
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
    mapUniqueConstraintError("commune", error);
  }
}

// Creates whichever of Province/Ville/Commune/Quartier the input stops at
// (schema-validated: the deepest filled-in level must be "new", so this
// always creates *something*). Resolves ancestors exactly like before —
// picking an existing one or creating a new one under the previous level.
export async function createTerritory(
  input: CreateTerritoryInput,
  actorId: string,
): Promise<TerritoryEntry> {
  const provinceId = await resolveProvince(input.province, actorId);
  let targetId = provinceId;

  if (input.ville) {
    const villeId = await resolveVille(input.ville, provinceId, actorId);
    targetId = villeId;

    if (input.commune) {
      const communeId = await resolveCommune(input.commune, villeId, actorId);
      targetId = communeId;

      if (input.quartierName) {
        try {
          const quartier = await createQuartierRow({
            name: input.quartierName,
            commune: { connect: { id: communeId } },
            createdBy: actorId,
            updatedBy: actorId,
          });
          targetId = quartier.id;
        } catch (error) {
          mapUniqueConstraintError("territory", error);
        }
      }
    }
  }

  const entry = await getTerritoryEntry(targetId);
  return entry!;
}

// Growing the hierarchy below the row being edited — e.g. editing a
// Province can also add a new Ville under it (and, cascading further, a
// Commune and a Quartier) in the same save. Schema-validated: the deepest
// filled-in level is always "new", and this can never run alongside
// deactivating the row itself (also schema-enforced) — so a freshly
// created, necessarily-active child is never left under a row this same
// request just made inactive.
async function addQuartierUnderCommune(
  communeId: string,
  name: string,
  actorId: string,
): Promise<void> {
  try {
    await createQuartierRow({
      name,
      commune: { connect: { id: communeId } },
      createdBy: actorId,
      updatedBy: actorId,
    });
  } catch (error) {
    mapUniqueConstraintError("territory", error);
  }
}

async function growBelowVille(
  villeId: string,
  input: UpdateTerritoryInput,
  actorId: string,
): Promise<void> {
  if (!input.newCommune) return;
  const communeId = await resolveCommune(input.newCommune, villeId, actorId);
  if (input.newQuartierName)
    await addQuartierUnderCommune(communeId, input.newQuartierName, actorId);
}

async function growBelowProvince(
  provinceId: string,
  input: UpdateTerritoryInput,
  actorId: string,
): Promise<void> {
  if (!input.newVille) return;
  const villeId = await resolveVille(input.newVille, provinceId, actorId);
  await growBelowVille(villeId, input, actorId);
}

async function updateProvinceEntry(input: UpdateTerritoryInput, actorId: string): Promise<void> {
  // Checked before the rename, not after, so a blocked deactivation leaves
  // nothing changed at all rather than a partially-applied rename.
  if (input.status === "INACTIVE") await assertProvinceCanDeactivate(input.id);

  try {
    await updateProvinceRow(input.id, { name: input.name, updatedBy: actorId });
  } catch (error) {
    mapUniqueConstraintError("province", error);
  }
  if (input.status === "ACTIVE") await activateProvince(input.id, actorId);
  else if (input.status === "INACTIVE") await deactivateProvince(input.id, actorId);

  await growBelowProvince(input.id, input, actorId);
}

async function updateVilleEntry(input: UpdateTerritoryInput, actorId: string): Promise<void> {
  const provinceId = await resolveProvince(input.province!, actorId);

  if (input.status === "INACTIVE") await assertVilleCanDeactivate(input.id);

  try {
    await updateVilleRow(input.id, {
      name: input.name,
      province: { connect: { id: provinceId } },
      updatedBy: actorId,
    });
  } catch (error) {
    mapUniqueConstraintError("ville", error);
  }

  if (input.status === "ACTIVE") await activateVille(input.id, actorId);
  else if (input.status === "INACTIVE") await deactivateVille(input.id, actorId);

  // Grown *before* the ancestor status change below: if the Province is
  // being deactivated in this same request, its cascade re-fetches
  // descendant ids fresh — after this — so a Commune/Quartier just added
  // here is still caught by it, rather than being created active and left
  // that way under a Province the same save just deactivated.
  await growBelowVille(input.id, input, actorId);

  if (input.province!.mode === "existing" && input.provinceStatus) {
    if (input.provinceStatus === "ACTIVE") await activateProvince(provinceId, actorId);
    else await deactivateProvince(provinceId, actorId);
  }
}

async function updateCommuneEntry(input: UpdateTerritoryInput, actorId: string): Promise<void> {
  const provinceId = await resolveProvince(input.province!, actorId);
  const villeId = await resolveVille(input.ville!, provinceId, actorId);

  if (input.status === "INACTIVE") await assertCommuneCanDeactivate(input.id);

  try {
    await updateCommuneRow(input.id, {
      name: input.name,
      ville: { connect: { id: villeId } },
      updatedBy: actorId,
    });
  } catch (error) {
    mapUniqueConstraintError("commune", error);
  }

  if (input.status === "ACTIVE") await activateCommune(input.id, actorId);
  else if (input.status === "INACTIVE") await deactivateCommune(input.id, actorId);

  if (input.newQuartierName)
    await addQuartierUnderCommune(input.id, input.newQuartierName, actorId);

  if (input.ville!.mode === "existing" && input.villeStatus) {
    if (input.villeStatus === "ACTIVE") await activateVille(villeId, actorId);
    else await deactivateVille(villeId, actorId);
  }
  if (input.province!.mode === "existing" && input.provinceStatus) {
    if (input.provinceStatus === "ACTIVE") await activateProvince(provinceId, actorId);
    else await deactivateProvince(provinceId, actorId);
  }
}

async function updateQuartierEntry(input: UpdateTerritoryInput, actorId: string): Promise<void> {
  const provinceId = await resolveProvince(input.province!, actorId);
  const villeId = await resolveVille(input.ville!, provinceId, actorId);
  const communeId = await resolveCommune(input.commune!, villeId, actorId);

  if (input.status === "INACTIVE") await assertQuartierCanDeactivate(input.id);

  try {
    await updateQuartierRow(input.id, {
      name: input.name,
      commune: { connect: { id: communeId } },
      updatedBy: actorId,
    });
  } catch (error) {
    mapUniqueConstraintError("territory", error);
  }

  if (input.status === "ACTIVE") await activateQuartier(input.id, actorId);
  else if (input.status === "INACTIVE") await deactivateQuartier(input.id, actorId);

  if (input.commune!.mode === "existing" && input.communeStatus) {
    if (input.communeStatus === "ACTIVE") await activateCommune(communeId, actorId);
    else await deactivateCommune(communeId, actorId);
  }
  if (input.ville!.mode === "existing" && input.villeStatus) {
    if (input.villeStatus === "ACTIVE") await activateVille(villeId, actorId);
    else await deactivateVille(villeId, actorId);
  }
  if (input.province!.mode === "existing" && input.provinceStatus) {
    if (input.provinceStatus === "ACTIVE") await activateProvince(provinceId, actorId);
    else await deactivateProvince(provinceId, actorId);
  }
}

// Renames and/or retoggles the status of whichever level `input.level`
// says — never extends a Territory deeper than the level it already is
// (that's what createTerritory is for). Ancestor status toggles
// (`provinceStatus`/`villeStatus`/`communeStatus`) are applied last, after
// the edited row's own rename/status — so if one of them is a
// deactivation, its cascade (which can reach this same row as a
// descendant) always has the final say over whatever this row's own
// toggle requested.
export async function updateTerritoryEntry(
  input: UpdateTerritoryInput,
  actorId: string,
): Promise<TerritoryEntry> {
  if (input.level === "province") await updateProvinceEntry(input, actorId);
  else if (input.level === "ville") await updateVilleEntry(input, actorId);
  else if (input.level === "commune") await updateCommuneEntry(input, actorId);
  else await updateQuartierEntry(input, actorId);

  const entry = await getTerritoryEntry(input.id);
  return entry!;
}
