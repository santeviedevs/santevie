import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

export function createImportBatch(
  data: Prisma.ImportBatchCreateInput,
): Promise<Prisma.ImportBatchGetPayload<Record<string, never>>> {
  return prisma.importBatch.create({ data });
}
