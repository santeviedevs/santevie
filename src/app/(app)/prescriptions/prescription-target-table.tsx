import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { ClickableTableRow } from "@/components/clickable-table-row";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Dictionary } from "@/lib/i18n/dictionary";

type Dict = Dictionary["prescriptionsPage"];

export type PrescriptionTargetTableRow = {
  id: string;
  monthlyTarget: number;
  periodMonth: number;
  periodYear: number;
  achieved: number;
  remaining: number;
  contact: { name: string };
  product: { name: string };
  user: { name: string };
};

export function PrescriptionTargetTable({
  rows,
  showDelegate = false,
  emptyLabel,
  dict,
}: {
  rows: PrescriptionTargetTableRow[];
  showDelegate?: boolean;
  emptyLabel: string;
  dict: Dict;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <>
      <div className="hidden min-w-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{dict.colContact}</TableHead>
              <TableHead>{dict.colProduct}</TableHead>
              {showDelegate ? <TableHead>{dict.colDelegate}</TableHead> : null}
              <TableHead>{dict.colPeriod}</TableHead>
              <TableHead>{dict.colTarget}</TableHead>
              <TableHead>{dict.colAchieved}</TableHead>
              <TableHead>{dict.colRemaining}</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <ClickableTableRow key={row.id} href={`/prescriptions/${row.id}`}>
                <TableCell className="font-medium">{row.contact.name}</TableCell>
                <TableCell>{row.product.name}</TableCell>
                {showDelegate ? <TableCell>{row.user.name}</TableCell> : null}
                <TableCell className="whitespace-nowrap">
                  {row.periodMonth}/{row.periodYear}
                </TableCell>
                <TableCell>{row.monthlyTarget}</TableCell>
                <TableCell>{row.achieved}</TableCell>
                <TableCell>{row.remaining}</TableCell>
                <TableCell className="text-right">
                  <ChevronRight
                    className="ml-auto size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </TableCell>
              </ClickableTableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col divide-y divide-border border-y border-border md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-2 py-3">
            <Link
              href={`/prescriptions/${row.id}`}
              className="flex items-center justify-between gap-2"
            >
              <span className="font-medium">
                {row.product.name} — {row.contact.name}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {showDelegate ? (
                <>
                  <dt className="text-muted-foreground">{dict.colDelegate}</dt>
                  <dd>{row.user.name}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">{dict.colPeriod}</dt>
              <dd>
                {row.periodMonth}/{row.periodYear}
              </dd>
              <dt className="text-muted-foreground">{dict.colTarget}</dt>
              <dd>{row.monthlyTarget}</dd>
              <dt className="text-muted-foreground">{dict.colAchieved}</dt>
              <dd>{row.achieved}</dd>
              <dt className="text-muted-foreground">{dict.colRemaining}</dt>
              <dd>{row.remaining}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
