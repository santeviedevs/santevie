import { prisma } from "@/server/db";

import type { Prisma } from "../../../generated/prisma/client";

export type ExchangeRateRow = Prisma.ExchangeRateGetPayload<Record<string, never>>;

// Append-only — see the comment on the ExchangeRate model. "Current" is
// always whichever row has the latest effectiveFrom.
export function findLatestExchangeRate(): Promise<ExchangeRateRow | null> {
  return prisma.exchangeRate.findFirst({ orderBy: { effectiveFrom: "desc" } });
}

export function listExchangeRateHistory(): Promise<ExchangeRateRow[]> {
  return prisma.exchangeRate.findMany({ orderBy: { effectiveFrom: "desc" } });
}

export function insertExchangeRate(data: Prisma.ExchangeRateCreateInput): Promise<ExchangeRateRow> {
  return prisma.exchangeRate.create({ data });
}
