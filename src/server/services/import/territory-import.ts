import {
  findCommuneByName,
  findProvinceByName,
  findQuartierByName,
  findVilleByName,
  upsertCommuneByName,
  upsertProvinceByName,
  upsertQuartierByName,
  upsertVilleByName,
} from "@/server/repositories/territory-repository";
import { findOrCreateTerritory, type ResolvedPath } from "@/server/services/territory-service";

import type { ImportProgress, ImportRowOutcome, ImportSummary } from "./types";
import { summarize } from "./types";

// S2-05's revised design: Territory owns the code (backend-generated), so
// import can no longer reference or create a territory by a spreadsheet
// code — it resolves/creates the geography path by name instead (same as
// the Territories admin form), then finds-or-creates the Territory that
// maps to it.
export const TERRITORY_IMPORT_COLUMNS = [
  "provinceName",
  "villeName",
  "communeName",
  "quartierName",
] as const;

type Level = "province" | "ville" | "commune" | "quartier";

type ResolvedTerritoryRow = {
  code: string;
  province: string;
  ville: string | null;
  commune: string | null;
  quartier: string | null;
};

// A placeholder id for a level this row would create — used only in
// preview (`commit: false`), so the chain can keep resolving levels below
// a not-yet-real parent without ever writing anything. Never a value a
// real Prisma id could collide with.
function syntheticId(level: Level, name: string): string {
  return `new:${level}:${name}`;
}

function validateName(value: string, label: string, errors: string[]): void {
  if (value.length < 1 || value.length > 120) {
    errors.push(`${label} name must be between 1 and 120 characters.`);
  }
}

// Real territory data repeats the same province/ville/commune name across
// hundreds of rows (a whole province's worth of quartiers, say). Without
// this, every row re-hits the database for names already resolved earlier
// in the same batch — up to 4 awaited round trips per row, fully
// sequential, which is what made a 591-row file crawl while a 2-row file
// felt instant. Keyed by level + parent + name so distinct parents never
// collide, cleared between calls since it only holds one batch's worth.
type LevelCache = Map<string, string | null>;

// Lowercased to match findXByName's case-insensitive matching (see
// territory-repository.ts) — the cache must agree with the database on
// what counts as "the same name", or a repeated name in a later row could
// resolve to a different id than the database would actually return.
function cacheKey(level: Level, parentId: string | null, name: string): string {
  return `${level}:${parentId ?? "root"}:${name.toLowerCase()}`;
}

// Resolves one geography level by name — an existing row under the parent
// is reused, otherwise a new one is created (commit) or a placeholder
// stands in for it (preview).
async function resolveLevel(
  level: Level,
  name: string,
  parentId: string | null,
  actorId: string,
  commit: boolean,
  errors: string[],
  cache: LevelCache,
): Promise<string | null> {
  validateName(name, level[0]!.toUpperCase() + level.slice(1), errors);
  if (errors.length > 0) return null;

  const key = cacheKey(level, parentId, name);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const resolved = await resolveLevelUncached(level, name, parentId, actorId, commit);
  cache.set(key, resolved);
  return resolved;
}

async function resolveLevelUncached(
  level: Level,
  name: string,
  parentId: string | null,
  actorId: string,
  commit: boolean,
): Promise<string | null> {
  if (level === "province") {
    const existing = await findProvinceByName(name);
    if (existing) return existing.id;
    if (!commit) return syntheticId(level, name);
    const row = await upsertProvinceByName(name, actorId);
    return row.id;
  }
  if (level === "ville") {
    const existing = await findVilleByName(parentId!, name);
    if (existing) return existing.id;
    if (!commit) return syntheticId(level, name);
    const row = await upsertVilleByName(parentId!, name, actorId);
    return row.id;
  }
  if (level === "commune") {
    const existing = await findCommuneByName(parentId!, name);
    if (existing) return existing.id;
    if (!commit) return syntheticId(level, name);
    const row = await upsertCommuneByName(parentId!, name, actorId);
    return row.id;
  }
  const existing = await findQuartierByName(parentId!, name);
  if (existing) return existing.id;
  if (!commit) return syntheticId(level, name);
  const row = await upsertQuartierByName(parentId!, name, actorId);
  return row.id;
}

// Resolves the whole Province → Ville → Commune → Quartier path a row
// asks for, stopping at whichever level the row's names stop at, then
// finds-or-creates the Territory mapping to that exact path — the same
// "same combination = same Territory" rule the admin form's create/edit
// flow uses.
async function resolveRow(
  row: Record<string, string>,
  rowNumber: number,
  actorId: string,
  commit: boolean,
  cache: LevelCache,
): Promise<ImportRowOutcome<ResolvedTerritoryRow>> {
  const errors: string[] = [];

  const provinceName = (row.provinceName ?? "").trim();
  if (!provinceName) {
    return { row: rowNumber, action: "reject", errors: ["Province name is required."] };
  }
  const villeName = (row.villeName ?? "").trim();
  const communeName = (row.communeName ?? "").trim();
  const quartierName = (row.quartierName ?? "").trim();

  if (communeName && !villeName) {
    return { row: rowNumber, action: "reject", errors: ["Ville is required before Commune."] };
  }
  if (quartierName && !communeName) {
    return { row: rowNumber, action: "reject", errors: ["Commune is required before Quartier."] };
  }

  const provinceId = await resolveLevel(
    "province",
    provinceName,
    null,
    actorId,
    commit,
    errors,
    cache,
  );
  if (!provinceId) return { row: rowNumber, action: "reject", errors };

  let villeId: string | null = null;
  let communeId: string | null = null;
  let quartierId: string | null = null;

  if (villeName) {
    villeId = await resolveLevel("ville", villeName, provinceId, actorId, commit, errors, cache);
    if (!villeId) return { row: rowNumber, action: "reject", errors };

    if (communeName) {
      communeId = await resolveLevel(
        "commune",
        communeName,
        villeId,
        actorId,
        commit,
        errors,
        cache,
      );
      if (!communeId) return { row: rowNumber, action: "reject", errors };

      if (quartierName) {
        quartierId = await resolveLevel(
          "quartier",
          quartierName,
          communeId,
          actorId,
          commit,
          errors,
          cache,
        );
        if (!quartierId) return { row: rowNumber, action: "reject", errors };
      }
    }
  }

  const path: ResolvedPath = { provinceId, villeId, communeId, quartierId };

  if (!commit) {
    // Preview: a synthetic id anywhere in the path means this Territory
    // can't already exist (its geography doesn't exist yet either), so
    // it's always a "create" — otherwise fall back to the real
    // find-or-create's own commit=false-equivalent read via pathKey isn't
    // available here without writing, so a fully-existing path is
    // resolved for real in commit and only previewed as "would match or
    // create" generically.
    const hasSynthetic = [provinceId, villeId, communeId, quartierId].some((id) =>
      id?.startsWith("new:"),
    );
    const data: ResolvedTerritoryRow = {
      code: hasSynthetic ? "(new)" : "(existing or new)",
      province: provinceName,
      ville: villeName || null,
      commune: communeName || null,
      quartier: quartierName || null,
    };
    return { row: rowNumber, action: "create", data };
  }

  const { territory, created } = await findOrCreateTerritory(path, actorId);
  const data: ResolvedTerritoryRow = {
    code: territory.code,
    province: provinceName,
    ville: villeName || null,
    commune: communeName || null,
    quartier: quartierName || null,
  };
  return created
    ? { row: rowNumber, action: "create", data }
    : { row: rowNumber, action: "update", id: territory.id, data };
}

export async function previewTerritoryImport(
  rows: Record<string, string>[],
  actorId: string,
  onProgress?: ImportProgress,
): Promise<ImportRowOutcome<ResolvedTerritoryRow>[]> {
  const outcomes: ImportRowOutcome<ResolvedTerritoryRow>[] = [];
  const cache: LevelCache = new Map();
  for (let index = 0; index < rows.length; index++) {
    outcomes.push(await resolveRow(rows[index]!, index + 2, actorId, false, cache));
    onProgress?.(index + 1, rows.length);
  }
  return outcomes;
}

export async function commitTerritoryImport(
  rows: Record<string, string>[],
  actorId: string,
  onProgress?: ImportProgress,
): Promise<{ summary: ImportSummary; outcomes: ImportRowOutcome<ResolvedTerritoryRow>[] }> {
  const outcomes: ImportRowOutcome<ResolvedTerritoryRow>[] = [];
  const cache: LevelCache = new Map();
  let created = 0;
  let updated = 0;

  for (let index = 0; index < rows.length; index++) {
    const outcome = await resolveRow(rows[index]!, index + 2, actorId, true, cache);
    outcomes.push(outcome);
    if (outcome.action === "create") created += 1;
    else if (outcome.action === "update") updated += 1;
    onProgress?.(index + 1, rows.length);
  }

  return { summary: summarize(rows.length, outcomes, { created, updated }), outcomes };
}
