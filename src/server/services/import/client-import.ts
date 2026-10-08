import { createClientSchema, updateClientSchema } from "@/lib/schemas/client";
import {
  findClientByCode,
  findClientTypeByCode,
  findTerritoryByCode,
} from "@/server/repositories/import-lookup-repository";
import { createClient, updateClient } from "@/server/services/client-service";

import type { ImportProgress, ImportRowOutcome, ImportSummary } from "./types";
import { summarize } from "./types";

// `territory` holds a Territory's own auto-generated code (e.g.
// "TER-00013") — client import references an existing Territory, it never
// creates one; only the dedicated territory importer does that.
export const CLIENT_IMPORT_COLUMNS = [
  "code",
  "name",
  "clientType",
  "responsiblePerson",
  "contact",
  "address",
  "latitude",
  "longitude",
  "territory",
  "hospitalCategory",
] as const;

type ResolvedClientInput = {
  code: string;
  name: string;
  typeId: string;
  responsiblePerson: string | null;
  contact: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  territoryId: string | null;
  hospital: { hospitalCategory: string | null } | null;
};

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringOrNull(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

// A code column resolved against a lookup — absent entirely is fine
// (nullable FK), present but unmatched is a row error.
async function resolveOptionalCode(
  code: string | undefined,
  label: string,
  lookup: (code: string) => Promise<{ id: string } | null>,
  errors: string[],
): Promise<string | null> {
  const trimmed = (code ?? "").trim();
  if (!trimmed) return null;
  const found = await lookup(trimmed);
  if (!found) {
    errors.push(`${label} code "${trimmed}" not found.`);
    return null;
  }
  return found.id;
}

async function resolveRow(
  row: Record<string, string>,
  rowNumber: number,
): Promise<ImportRowOutcome<ResolvedClientInput>> {
  const errors: string[] = [];

  const code = (row.code ?? "").trim();
  const name = (row.name ?? "").trim();
  const typeCode = (row.clientType ?? "").trim();

  let typeId = "";
  let resolvedTypeCode = "";
  if (!typeCode) {
    errors.push("Client type is required.");
  } else {
    const type = await findClientTypeByCode(typeCode);
    if (!type) errors.push(`Client type "${typeCode}" not found.`);
    else {
      typeId = type.id;
      resolvedTypeCode = type.code;
    }
  }

  const territoryId = await resolveOptionalCode(
    row.territory,
    "Territory",
    findTerritoryByCode,
    errors,
  );

  const isHospital = resolvedTypeCode === "HOSPITAL";

  // hospitalCategory is ignored for non-Hospital rows rather than rejected,
  // same as the manual form never asks for it.
  const hospital = isHospital ? { hospitalCategory: toStringOrNull(row.hospitalCategory) } : null;

  const latitude = toNumberOrNull(row.latitude ?? "");
  const longitude = toNumberOrNull(row.longitude ?? "");

  const existing = code ? await findClientByCode(code) : null;

  const candidate = {
    code,
    name,
    typeId,
    responsiblePerson: toStringOrNull(row.responsiblePerson),
    contact: toStringOrNull(row.contact),
    address: toStringOrNull(row.address),
    latitude,
    longitude,
    territoryId,
    hospital: hospital ?? undefined,
  };
  const schema = existing ? updateClientSchema : createClientSchema;
  const parsed = schema.safeParse(existing ? { ...candidate, id: existing.id } : candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors.push(issue.message);
  }

  if (errors.length > 0) {
    return { row: rowNumber, action: "reject", errors };
  }

  const data: ResolvedClientInput = {
    code,
    name,
    typeId,
    responsiblePerson: candidate.responsiblePerson,
    contact: candidate.contact,
    address: candidate.address,
    latitude,
    longitude,
    territoryId,
    hospital,
  };
  return existing
    ? { row: rowNumber, action: "update", id: existing.id, data }
    : { row: rowNumber, action: "create", data };
}

export async function previewClientImport(
  rows: Record<string, string>[],
  _actorId?: string,
  onProgress?: ImportProgress,
) {
  const outcomes: Awaited<ReturnType<typeof resolveRow>>[] = [];
  for (let index = 0; index < rows.length; index++) {
    outcomes.push(await resolveRow(rows[index]!, index + 2));
    onProgress?.(index + 1, rows.length);
  }
  return outcomes;
}

// Progress spans both the resolve pass and the write pass (2×rows.length
// steps total) — resolving is itself a full pass over every row, so
// reporting only the write pass would jump from 0% to 50% the instant
// resolving finishes.
export async function commitClientImport(
  rows: Record<string, string>[],
  actorId: string,
  onProgress?: ImportProgress,
): Promise<{ summary: ImportSummary }> {
  const totalSteps = rows.length * 2;
  const outcomes = await previewClientImport(rows, undefined, (done) =>
    onProgress?.(done, totalSteps),
  );
  let created = 0;
  let updated = 0;
  let writeIndex = 0;

  for (const outcome of outcomes) {
    if (outcome.action === "create") {
      await createClient(
        {
          code: outcome.data.code,
          name: outcome.data.name,
          typeId: outcome.data.typeId,
          responsiblePerson: outcome.data.responsiblePerson,
          contact: outcome.data.contact,
          address: outcome.data.address,
          latitude: outcome.data.latitude,
          longitude: outcome.data.longitude,
          territoryId: outcome.data.territoryId,
          hospital: outcome.data.hospital ?? undefined,
        },
        actorId,
      );
      created += 1;
    } else if (outcome.action === "update") {
      await updateClient(
        {
          id: outcome.id,
          code: outcome.data.code,
          name: outcome.data.name,
          typeId: outcome.data.typeId,
          responsiblePerson: outcome.data.responsiblePerson,
          contact: outcome.data.contact,
          address: outcome.data.address,
          latitude: outcome.data.latitude,
          longitude: outcome.data.longitude,
          territoryId: outcome.data.territoryId,
          hospital: outcome.data.hospital ?? undefined,
        },
        actorId,
      );
      updated += 1;
    }
    writeIndex += 1;
    onProgress?.(rows.length + writeIndex, totalSteps);
  }

  const summary = summarize(rows.length, outcomes, { created, updated });
  return { summary };
}
