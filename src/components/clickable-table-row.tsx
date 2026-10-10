"use client";

import { useRouter } from "next/navigation";

import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const INTERACTIVE = "a, button, input, select, textarea, label, [role='button'], [role='link']";

// A table row that opens `href` when clicked anywhere on it. The keyboard and
// screen-reader path is the real link inside the row (the route code cell),
// so the row keeps its native table semantics and nothing needs a fake
// `role` or tabIndex. A click that lands on any interactive element inside
// the row (a link, button, input...) is left to that element and never also
// triggers the row, and neither is the end of a text selection.
export function ClickableTableRow({
  href,
  className,
  ...props
}: { href: string } & React.ComponentProps<typeof TableRow>) {
  const router = useRouter();

  return (
    <TableRow
      {...props}
      className={cn(
        "cursor-pointer focus-within:bg-muted/50 [&:has(a:focus-visible)]:ring-2 [&:has(a:focus-visible)]:ring-ring/50 [&:has(a:focus-visible)]:ring-inset",
        className,
      )}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
        if (window.getSelection()?.toString()) return;
        if (event.metaKey || event.ctrlKey) {
          window.open(href, "_blank", "noopener");
          return;
        }
        router.push(href);
      }}
    />
  );
}
