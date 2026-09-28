import { createProductSchema, updateProductSchema } from "@/lib/schemas/product";
import {
  findProductByCode,
  findProductCategoryByCode,
} from "@/server/repositories/import-lookup-repository";
import { createProduct, updateProduct } from "@/server/services/product-service";

import type { ImportProgress, ImportRowOutcome, ImportSummary } from "./types";
import { summarize } from "./types";

export const PRODUCT_IMPORT_COLUMNS = [
  "code",
  "name",
  "category",
  "grossPrice",
  "netPrice",
] as const;

type ResolvedProductInput = {
  code: string;
  name: string;
  categoryId: string | null;
  grossPrice: number;
  netPrice: number;
};

function toNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Resolves and validates one spreadsheet row — shared by the dry-run
// preview and the commit pass, so a row can never pass preview and then
// fail commit (or the reverse) from validation drifting between the two.
async function resolveRow(
  row: Record<string, string>,
  rowNumber: number,
): Promise<ImportRowOutcome<ResolvedProductInput>> {
  const errors: string[] = [];

  const code = (row.code ?? "").trim();
  const name = (row.name ?? "").trim();
  const categoryCode = (row.category ?? "").trim();
  const grossPrice = toNumber(row.grossPrice ?? "");
  const netPrice = toNumber(row.netPrice ?? "");

  let categoryId: string | null = null;
  if (categoryCode) {
    const category = await findProductCategoryByCode(categoryCode);
    if (!category) errors.push(`Category "${categoryCode}" not found.`);
    else categoryId = category.id;
  }

  const existing = code ? await findProductByCode(code) : null;

  const candidate = {
    code,
    name,
    categoryId,
    grossPrice: grossPrice ?? 0,
    netPrice: netPrice ?? 0,
  };
  const schema = existing ? updateProductSchema : createProductSchema;
  const parsed = schema.safeParse(existing ? { ...candidate, id: existing.id } : candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors.push(issue.message);
  }

  if (errors.length > 0) return { row: rowNumber, action: "reject", errors };

  const data: ResolvedProductInput = {
    code,
    name,
    categoryId,
    grossPrice: grossPrice!,
    netPrice: netPrice!,
  };
  return existing
    ? { row: rowNumber, action: "update", id: existing.id, data }
    : { row: rowNumber, action: "create", data };
}

export async function previewProductImport(
  rows: Record<string, string>[],
  // Unused — kept so this matches the shared ImportRunner.preview shape
  // (territory's preview genuinely needs an actor id; product doesn't).
  _actorId?: string,
  onProgress?: ImportProgress,
): Promise<ImportRowOutcome<ResolvedProductInput>[]> {
  const outcomes: ImportRowOutcome<ResolvedProductInput>[] = [];
  for (let index = 0; index < rows.length; index++) {
    outcomes.push(await resolveRow(rows[index]!, index + 2));
    onProgress?.(index + 1, rows.length);
  }
  return outcomes;
}

// Progress spans both the resolve pass and the write pass below (see the
// same note on commitClientImport) so it doesn't jump straight to 50%.
export async function commitProductImport(
  rows: Record<string, string>[],
  actorId: string,
  onProgress?: ImportProgress,
): Promise<{ summary: ImportSummary; outcomes: ImportRowOutcome<ResolvedProductInput>[] }> {
  const totalSteps = rows.length * 2;
  const outcomes = await previewProductImport(rows, undefined, (done) =>
    onProgress?.(done, totalSteps),
  );
  let created = 0;
  let updated = 0;
  let writeIndex = 0;

  for (const outcome of outcomes) {
    if (outcome.action === "create") {
      await createProduct(
        {
          code: outcome.data.code,
          name: outcome.data.name,
          categoryId: outcome.data.categoryId,
          grossPrice: outcome.data.grossPrice,
          netPrice: outcome.data.netPrice,
        },
        actorId,
      );
      created += 1;
    } else if (outcome.action === "update") {
      await updateProduct(
        {
          id: outcome.id,
          code: outcome.data.code,
          name: outcome.data.name,
          categoryId: outcome.data.categoryId,
          grossPrice: outcome.data.grossPrice,
          netPrice: outcome.data.netPrice,
        },
        actorId,
      );
      updated += 1;
    }
    writeIndex += 1;
    onProgress?.(rows.length + writeIndex, totalSteps);
  }

  return { summary: summarize(rows.length, outcomes, { created, updated }), outcomes };
}
