import type { SetExchangeRateInput } from "@/lib/schemas/exchange-rate";
import {
  findLatestExchangeRate,
  insertExchangeRate,
  listExchangeRateHistory,
} from "@/server/repositories/exchange-rate-repository";

export type ExchangeRateEntry = { id: string; rate: number; effectiveFrom: Date };

// The one shared place every feature reads the current USD → CDF rate from
// (dashboard, reports, order summary, the product list's currency toggle),
// same role as src/server/scope.ts for the hierarchy filter — so none of
// them can drift out of sync by rolling their own lookup. Returns null
// until an admin has ever set a rate; callers fall back to USD-only
// display in that case, never a guessed rate.
export async function getCurrentExchangeRate(): Promise<ExchangeRateEntry | null> {
  const latest = await findLatestExchangeRate();
  return latest
    ? { id: latest.id, rate: Number(latest.rate), effectiveFrom: latest.effectiveFrom }
    : null;
}

export async function listExchangeRateEntries(): Promise<ExchangeRateEntry[]> {
  const rows = await listExchangeRateHistory();
  return rows.map((row) => ({
    id: row.id,
    rate: Number(row.rate),
    effectiveFrom: row.effectiveFrom,
  }));
}

// Always inserts a new row rather than overwriting the last one — see the
// ExchangeRate model comment. Nothing that already snapshotted a rate
// (e.g. an Order, in a later sprint) is affected by this.
export async function setExchangeRate(
  input: SetExchangeRateInput,
  actorId: string,
): Promise<ExchangeRateEntry> {
  const row = await insertExchangeRate({
    rate: input.rate,
    createdBy: actorId,
    updatedBy: actorId,
  });
  return { id: row.id, rate: Number(row.rate), effectiveFrom: row.effectiveFrom };
}

export function convertToCdf(usdAmount: number, rate: number): number {
  return usdAmount * rate;
}
