"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

// A wide table's native horizontal scrollbar is unreliable as a "this is
// scrollable" cue: it sits at the bottom of the box (not above the
// content), most OSes hide it until an active scroll gesture, and macOS
// hides it entirely unless "always show scrollbars" is set — none of which
// tells a first-time viewer they can swipe sideways. This measures actual
// overflow via ResizeObserver/scroll events and renders its own thin,
// always-visible track above the table whenever content overflows.
function Table({ className, ...props }: React.ComponentProps<"table">) {
  const scrollContainerId = React.useId();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = React.useState({
    canScroll: false,
    thumbWidthPct: 100,
    thumbLeftPct: 0,
    scrollRatioPct: 0,
  });

  const updateIndicator = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollWidth, clientWidth, scrollLeft } = el;
    const canScroll = scrollWidth > clientWidth + 1;
    if (!canScroll) {
      setIndicator({ canScroll: false, thumbWidthPct: 100, thumbLeftPct: 0, scrollRatioPct: 0 });
      return;
    }

    const thumbWidthPct = Math.max((clientWidth / scrollWidth) * 100, 8);
    const maxScrollLeft = scrollWidth - clientWidth;
    const scrollRatio = maxScrollLeft > 0 ? scrollLeft / maxScrollLeft : 0;
    const thumbLeftPct = scrollRatio * (100 - thumbWidthPct);

    setIndicator({ canScroll, thumbWidthPct, thumbLeftPct, scrollRatioPct: scrollRatio * 100 });
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateIndicator();

    const resizeObserver = new ResizeObserver(updateIndicator);
    resizeObserver.observe(el);

    el.addEventListener("scroll", updateIndicator, { passive: true });
    return () => {
      resizeObserver.disconnect();
      el.removeEventListener("scroll", updateIndicator);
    };
  }, [updateIndicator]);

  const scrollToRatio = (clientX: number, track: HTMLDivElement) => {
    const el = scrollRef.current;
    if (!el) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    el.scrollLeft = ratio * (el.scrollWidth - el.clientWidth);
  };

  return (
    <div data-slot="table-root" className="flex flex-col gap-1.5">
      {indicator.canScroll ? (
        <div
          role="scrollbar"
          aria-orientation="horizontal"
          aria-controls={scrollContainerId}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(indicator.scrollRatioPct)}
          data-slot="table-scroll-track"
          className="h-1.5 w-full shrink-0 cursor-pointer rounded-full bg-muted"
          onPointerDown={(event) => {
            const track = event.currentTarget;
            scrollToRatio(event.clientX, track);

            const onMove = (moveEvent: PointerEvent) => scrollToRatio(moveEvent.clientX, track);
            const onUp = () => {
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup", onUp);
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
          }}
        >
          <div
            data-slot="table-scroll-thumb"
            className="h-full rounded-full bg-muted-foreground/50"
            style={{
              width: `${indicator.thumbWidthPct}%`,
              marginLeft: `${indicator.thumbLeftPct}%`,
            }}
          />
        </div>
      ) : null}
      <div
        id={scrollContainerId}
        ref={scrollRef}
        data-slot="table-container"
        className="relative w-full overflow-x-auto"
      >
        <table
          data-slot="table"
          className={cn("w-full caption-bottom text-sm", className)}
          {...props}
        />
      </div>
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0", className)}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow };
