import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getServerDictionary } from "@/lib/i18n/server";
import { hasPermission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";
import { listActiveCentersForSelection } from "@/server/repositories/center-repository";
import { listActiveProductsForSelection } from "@/server/repositories/product-repository";
import { getEmballageReport } from "@/server/services/emballage-service";

import { FinalizeReportButton } from "./finalize-report-button";
import { ReportFilters } from "./report-filters";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

// EOM centre-wise x product-wise total quantity, for verification against
// what was physically collected (§3.6/§4 of Marketing Activity.md). Totals
// always reflect the current (corrected) quantity. Finalizing locks the
// selected month's records — offered only to emballage:finalize-report.
export default async function EmballageReportPage({ searchParams }: PageProps) {
  const session = await requirePermission("emballage:view-team");
  const dict = await getServerDictionary();
  const t = dict.emballagePage;
  const canFinalize = hasPermission(session.user.permissions, "emballage:finalize-report");

  const now = new Date();
  const params = await searchParams;
  const periodMonth = Number(firstValue(params.periodMonth) ?? now.getUTCMonth() + 1);
  const periodYear = Number(firstValue(params.periodYear) ?? now.getUTCFullYear());
  const centerId = firstValue(params.centerId);
  const productId = firstValue(params.productId);

  const [lines, centers, products] = await Promise.all([
    getEmballageReport(periodMonth, periodYear, centerId, productId),
    listActiveCentersForSelection(),
    listActiveProductsForSelection(),
  ]);

  const exportParams = new URLSearchParams({
    periodMonth: String(periodMonth),
    periodYear: String(periodYear),
  });
  if (centerId) exportParams.set("centerId", centerId);
  if (productId) exportParams.set("productId", productId);
  const exportHref = `/api/emballage/export?${exportParams.toString()}`;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t.teamReport}</h1>
        <div className="flex gap-2">
          <Button render={<a href={exportHref} />} variant="outline">
            <Download aria-hidden />
            {t.exportExcel}
          </Button>
          {canFinalize ? (
            <FinalizeReportButton periodMonth={periodMonth} periodYear={periodYear} dict={t} />
          ) : null}
        </div>
      </div>

      <ReportFilters
        periodMonth={periodMonth}
        periodYear={periodYear}
        centerId={centerId}
        productId={productId}
        centers={centers.map((c) => ({ id: c.id, label: c.name }))}
        products={products.map((p) => ({ id: p.id, label: p.name }))}
        dict={t}
      />

      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.noReportData}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.colCenter}</TableHead>
              <TableHead>{t.colProduct}</TableHead>
              <TableHead>{t.colTotalQuantity}</TableHead>
              <TableHead>{t.colCollectionCount}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={`${line.centerId}:${line.productId}`}>
                <TableCell className="font-medium">{line.centerName}</TableCell>
                <TableCell>{line.productName}</TableCell>
                <TableCell>{line.totalQuantity}</TableCell>
                <TableCell>{line.collectionCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} className="font-medium">
                {t.colCollectionCount}
              </TableCell>
              <TableCell className="font-medium">
                {lines.reduce((sum, line) => sum + line.collectionCount, 0)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </div>
  );
}
