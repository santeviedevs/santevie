"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { totalPages as computeTotalPages } from "@/lib/pagination";

// Shared by every admin/team list screen (S2-06). Changing a filter never
// preserves `page` (each filter component rebuilds the query string from
// scratch), so a filter change always lands back on page 1 for free — this
// component only ever needs to add/replace `page` on top of whatever
// filters are already in the URL.
//
// `pageInfoLabel` arrives pre-formatted from the server: Dictionary's
// pageInfo is a function, and a function can't be passed from a Server
// Component into a Client Component (it's not serializable across that
// boundary) — the caller resolves it to a plain string before this renders.
export function PaginationControls({
  page,
  pageSize,
  total,
  previousLabel,
  nextLabel,
  pageInfoLabel,
}: {
  page: number;
  pageSize: number;
  total: number;
  previousLabel: string;
  nextLabel: string;
  pageInfoLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = computeTotalPages(total, pageSize);

  if (total === 0) return null;

  function goToPage(target: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(target));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{pageInfoLabel}</span>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => goToPage(page - 1)}
        >
          {previousLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => goToPage(page + 1)}
        >
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
