import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { ClickableTableRow } from "@/components/clickable-table-row";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format-date";
import type { Dictionary } from "@/lib/i18n/dictionary";

type Dict = Dictionary["emballagePage"];

export type EmballageTableRow = {
  id: string;
  visitDate: Date;
  quantity: string;
  correctionCount: number;
  locked: boolean;
  center: { name: string };
  product: { name: string };
  user: { name: string };
};

export function EmballageTable({
  rows,
  showUser = false,
  emptyLabel,
  dict,
}: {
  rows: EmballageTableRow[];
  showUser?: boolean;
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
              <TableHead>{dict.colDate}</TableHead>
              <TableHead>{dict.colCenter}</TableHead>
              <TableHead>{dict.colProduct}</TableHead>
              {showUser ? <TableHead>{dict.colUser}</TableHead> : null}
              <TableHead>{dict.colQuantity}</TableHead>
              <TableHead />
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <ClickableTableRow key={row.id} href={`/emballage/${row.id}`}>
                <TableCell className="whitespace-nowrap">{formatDate(row.visitDate)}</TableCell>
                <TableCell className="font-medium">{row.center.name}</TableCell>
                <TableCell>{row.product.name}</TableCell>
                {showUser ? <TableCell>{row.user.name}</TableCell> : null}
                <TableCell>{row.quantity}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {row.correctionCount > 0 ? (
                      <Badge variant="outline">{dict.correctedBadge}</Badge>
                    ) : null}
                    {row.locked ? <Badge variant="secondary">{dict.lockedBadge}</Badge> : null}
                  </div>
                </TableCell>
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
            <Link href={`/emballage/${row.id}`} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="font-medium">{row.center.name}</span>
                {row.correctionCount > 0 ? (
                  <Badge variant="outline">{dict.correctedBadge}</Badge>
                ) : null}
                {row.locked ? <Badge variant="secondary">{dict.lockedBadge}</Badge> : null}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{dict.colProduct}</dt>
              <dd>{row.product.name}</dd>
              {showUser ? (
                <>
                  <dt className="text-muted-foreground">{dict.colUser}</dt>
                  <dd>{row.user.name}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">{dict.colQuantity}</dt>
              <dd>{row.quantity}</dd>
              <dt className="text-muted-foreground">{dict.colDate}</dt>
              <dd>{formatDate(row.visitDate)}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
