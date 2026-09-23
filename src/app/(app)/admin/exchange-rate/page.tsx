import { formatCdf, formatUsd } from "@/lib/format-money";
import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getCurrentExchangeRate, listExchangeRateEntries } from "@/server/services/exchange-rate-service";

import { ExchangeRateForm } from "./exchange-rate-form";

// Rate-dependent, same reasoning as every other admin screen (execution
// plan, Section 4) — never statically cached.
export const dynamic = "force-dynamic";

export default async function ExchangeRatePage() {
  await requirePermission("products:manage");

  const [current, history, dict] = await Promise.all([
    getCurrentExchangeRate(),
    listExchangeRateEntries(),
    getServerDictionary(),
  ]);
  const t = dict.exchangeRatePage;

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{t.title}</h1>

      <div className="rounded-md border border-border p-4">
        <p className="text-sm text-muted-foreground">{t.currentRateLabel}</p>
        <p className="text-lg font-semibold">
          {current
            ? `${formatUsd(1)} = ${formatCdf(current.rate)}`
            : t.noRateSet}
        </p>
      </div>

      <ExchangeRateForm currentRate={current?.rate ?? null} dict={t} />

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{t.historyTitle}</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {history.map((entry) => (
            <li key={entry.id} className="flex justify-between border-b border-border py-1">
              <span>{formatCdf(entry.rate)}</span>
              <span className="text-muted-foreground">
                {new Date(entry.effectiveFrom).toLocaleString()}
              </span>
            </li>
          ))}
          {history.length === 0 ? (
            <li className="text-muted-foreground">{t.noRateSet}</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
