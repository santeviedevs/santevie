import { createClientSchema, updateClientSchema } from "@/lib/schemas/client";
import { setDoctorHospitals } from "@/server/repositories/doctor-hospital-repository";
import {
  findClientByCode,
  findClientTypeByCode,
  findHospitalLookupByClientCodes,
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
  "contact",
  "address",
  "latitude",
  "longitude",
  "territory",
  "doctorType",
  "gender",
  "department",
  "mobileNo",
  "hospitalCategory",
  // Comma-separated Client codes of the Hospitals this Doctor is linked
  // to — resolved in a second pass, after every row in the file has been
  // committed, since a Doctor row can reference a Hospital row that only
  // appears later in the same file (S2-05: the doctor/hospital ordering
  // problem flagged during scoping).
  "hospitals",
] as const;

type ResolvedClientInput = {
  code: string;
  name: string;
  typeId: string;
  contact: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  territoryId: string | null;
  doctor: {
    doctorType: string | null;
    gender: string | null;
    department: string | null;
    mobileNo: string | null;
  } | null;
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
): Promise<
  ImportRowOutcome<ResolvedClientInput> & { hospitalCodes: string[]; doctorFlag: boolean }
> {
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

  const isDoctor = resolvedTypeCode === "DOCTOR";
  const isHospital = resolvedTypeCode === "HOSPITAL";

  // Fields for the wrong type are ignored rather than rejected — a Doctor
  // row simply has no use for hospitalCategory, same as the manual form
  // never asks for it.
  const doctor = isDoctor
    ? {
        doctorType: toStringOrNull(row.doctorType),
        gender: toStringOrNull(row.gender),
        department: toStringOrNull(row.department),
        mobileNo: toStringOrNull(row.mobileNo),
      }
    : null;
  const hospital = isHospital ? { hospitalCategory: toStringOrNull(row.hospitalCategory) } : null;

  const hospitalCodes = isDoctor
    ? (row.hospitals ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : [];

  const latitude = toNumberOrNull(row.latitude ?? "");
  const longitude = toNumberOrNull(row.longitude ?? "");

  const existing = code ? await findClientByCode(code) : null;

  const candidate = {
    code,
    name,
    typeId,
    contact: toStringOrNull(row.contact),
    address: toStringOrNull(row.address),
    latitude,
    longitude,
    territoryId,
    doctor: doctor ?? undefined,
    hospital: hospital ?? undefined,
  };
  const schema = existing ? updateClientSchema : createClientSchema;
  const parsed = schema.safeParse(existing ? { ...candidate, id: existing.id } : candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors.push(issue.message);
  }

  if (errors.length > 0) {
    return { row: rowNumber, action: "reject", errors, hospitalCodes: [], doctorFlag: false };
  }

  const data: ResolvedClientInput = {
    code,
    name,
    typeId,
    contact: candidate.contact,
    address: candidate.address,
    latitude,
    longitude,
    territoryId,
    doctor,
    hospital,
  };
  return existing
    ? {
        row: rowNumber,
        action: "update",
        id: existing.id,
        data,
        hospitalCodes,
        doctorFlag: isDoctor,
      }
    : { row: rowNumber, action: "create", data, hospitalCodes, doctorFlag: isDoctor };
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

// Pass 1 commits every row (create/update, no hospital links yet). Pass 2
// — only after every row has landed — resolves each Doctor row's
// `hospitalCodes` against the now-complete set of Clients and replaces
// its full DoctorHospital set (S2-05: "replace, not merge" on re-import,
// confirmed with the lead).
//
// Progress spans both the resolve pass and this write pass (2×rows.length
// steps total) — resolving is itself a full pass over every row, so
// reporting only the write pass would jump from 0% to 50% the instant
// resolving finishes.
export async function commitClientImport(
  rows: Record<string, string>[],
  actorId: string,
  onProgress?: ImportProgress,
): Promise<{ summary: ImportSummary; linkWarnings: { row: number; errors: string[] }[] }> {
  const totalSteps = rows.length * 2;
  const outcomes = await previewClientImport(rows, undefined, (done) =>
    onProgress?.(done, totalSteps),
  );
  let created = 0;
  let updated = 0;
  let writeIndex = 0;
  const pendingLinks: { doctorId: string; hospitalCodes: string[]; row: number }[] = [];
  const linkErrors: { row: number; errors: string[] }[] = [];

  for (const outcome of outcomes) {
    if (outcome.action === "create") {
      const result = await createClient(
        {
          code: outcome.data.code,
          name: outcome.data.name,
          typeId: outcome.data.typeId,
          contact: outcome.data.contact,
          address: outcome.data.address,
          latitude: outcome.data.latitude,
          longitude: outcome.data.longitude,
          territoryId: outcome.data.territoryId,
          doctor: outcome.data.doctor ?? undefined,
          hospital: outcome.data.hospital ?? undefined,
        },
        actorId,
      );
      created += 1;
      if (outcome.doctorFlag && outcome.hospitalCodes.length > 0 && result.doctor) {
        pendingLinks.push({
          doctorId: result.doctor.id,
          hospitalCodes: outcome.hospitalCodes,
          row: outcome.row,
        });
      }
    } else if (outcome.action === "update") {
      const result = await updateClient(
        {
          id: outcome.id,
          code: outcome.data.code,
          name: outcome.data.name,
          typeId: outcome.data.typeId,
          contact: outcome.data.contact,
          address: outcome.data.address,
          latitude: outcome.data.latitude,
          longitude: outcome.data.longitude,
          territoryId: outcome.data.territoryId,
          doctor: outcome.data.doctor ?? undefined,
          hospital: outcome.data.hospital ?? undefined,
        },
        actorId,
      );
      updated += 1;
      if (outcome.doctorFlag && outcome.hospitalCodes.length > 0 && result.doctor) {
        pendingLinks.push({
          doctorId: result.doctor.id,
          hospitalCodes: outcome.hospitalCodes,
          row: outcome.row,
        });
      }
    }
    writeIndex += 1;
    onProgress?.(rows.length + writeIndex, totalSteps);
  }

  // Pass 2: resolve every pending Doctor→Hospital link now that all rows
  // in this file (and any pre-existing data) have landed.
  const allCodes = Array.from(new Set(pendingLinks.flatMap((link) => link.hospitalCodes)));
  const lookup = allCodes.length > 0 ? await findHospitalLookupByClientCodes(allCodes) : [];
  const hospitalIdByCode = new Map<string, string>();
  for (const client of lookup) {
    if (client.hospital) hospitalIdByCode.set(client.code, client.hospital.id);
  }

  for (const link of pendingLinks) {
    const hospitalIds: string[] = [];
    const rowErrors: string[] = [];
    for (const code of link.hospitalCodes) {
      const hospitalId = hospitalIdByCode.get(code);
      if (!hospitalId)
        rowErrors.push(`Hospital code "${code}" not found among Hospital-type clients.`);
      else hospitalIds.push(hospitalId);
    }
    if (rowErrors.length > 0) linkErrors.push({ row: link.row, errors: rowErrors });
    await setDoctorHospitals(link.doctorId, hospitalIds, actorId);
  }

  const summary = summarize(rows.length, outcomes, { created, updated });
  return { summary, linkWarnings: linkErrors };
}
