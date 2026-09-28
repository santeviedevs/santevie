import { createImportBatch } from "@/server/repositories/import-batch-repository";

import type { ImportSummary } from "./import/types";

export type ImportEntityType = "TERRITORY" | "CLIENT" | "PRODUCT";

// One audit record per completed import run (S2-05) — separate from each
// imported row's own createdBy/updatedBy, so "who ran this import and what
// happened" never has to be reconstructed after the fact.
export async function recordImportBatch(
  entity: ImportEntityType,
  fileName: string,
  summary: ImportSummary,
  actorId: string,
): Promise<void> {
  await createImportBatch({
    entity,
    fileName,
    totalRows: summary.totalRows,
    createdCount: summary.createdCount,
    updatedCount: summary.updatedCount,
    rejectedCount: summary.rejectedCount,
    createdBy: actorId,
    updatedBy: actorId,
  });
}
