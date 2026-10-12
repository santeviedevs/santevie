import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Dictionary } from "@/lib/i18n/dictionary";
import type { RouteFilters as RouteFiltersValue } from "@/lib/schemas/route";

const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/routes/assign",
  useSearchParams: () => new URLSearchParams(search),
}));

const { RouteFilters } = await import("./route-filters");

const dict = new Proxy({}, { get: (_, key) => String(key) }) as Dictionary["routesPage"];
const base: RouteFiltersValue = { page: 1, pageSize: 20 };

beforeEach(() => {
  vi.clearAllMocks();
  search = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ users: [] }) })),
  );
});

describe("RouteFilters", () => {
  it("puts search, assignee, status, From and To in one row, in that order, wrapping on small screens", () => {
    const { container } = render(<RouteFilters filters={base} assigneeLabel={null} dict={dict} />);
    const row = container.firstElementChild as HTMLElement;

    // One flex row on desktop (no wrapping at lg), wrapping below it.
    expect(row.className).toContain("lg:flex-nowrap");
    expect(row.className).toContain("flex-wrap");

    const [from, to] = Array.from(row.querySelectorAll<HTMLInputElement>("input[type='date']"));
    const ordered = [
      screen.getByLabelText("filterSearchPlaceholder"),
      screen.getByPlaceholderText("filterAnyAssignee"),
      screen.getByLabelText("colStatus"),
      from!,
      to!,
    ];
    for (let i = 0; i < ordered.length - 1; i++) {
      expect(ordered[i]!.compareDocumentPosition(ordered[i + 1]!)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }
    const dates = row.querySelectorAll<HTMLInputElement>("input[type='date']");
    expect(dates).toHaveLength(2);
    expect(dates[0]!.closest("label")).toHaveTextContent("filterFrom");
    expect(dates[1]!.closest("label")).toHaveTextContent("filterTo");
  });

  it("keeps the two date filters compact", () => {
    const { container } = render(<RouteFilters filters={base} assigneeLabel={null} dict={dict} />);
    for (const input of container.querySelectorAll("input[type='date']")) {
      expect(input.className).toContain("w-36");
    }
  });

  it("won't let To be earlier than From", () => {
    const { container } = render(
      <RouteFilters filters={{ ...base, from: "2026-06-20" }} assigneeLabel={null} dict={dict} />,
    );
    const [, to] = Array.from(container.querySelectorAll<HTMLInputElement>("input[type='date']"));
    expect(to).toHaveAttribute("min", "2026-06-20");
  });

  it("writes a date filter to the URL and drops the page, so a filter change lands on page 1", () => {
    search = "page=3&status=MISSED";
    const { container } = render(<RouteFilters filters={base} assigneeLabel={null} dict={dict} />);
    const [from] = Array.from(container.querySelectorAll<HTMLInputElement>("input[type='date']"));

    fireEvent.change(from!, { target: { value: "2026-06-16" } });
    expect(replace).toHaveBeenCalledWith("/routes/assign?status=MISSED&from=2026-06-16");
  });

  it("debounces the search box before touching the URL", () => {
    vi.useFakeTimers();
    render(<RouteFilters filters={base} assigneeLabel={null} dict={dict} />);

    fireEvent.change(screen.getByLabelText("filterSearchPlaceholder"), {
      target: { value: "RT-0" },
    });
    expect(replace).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(replace).toHaveBeenCalledWith("/routes/assign?q=RT-0");
    vi.useRealTimers();
  });

  it("offers Clear filters only while a filter is active, and clears the URL", () => {
    const { rerender } = render(<RouteFilters filters={base} assigneeLabel={null} dict={dict} />);
    expect(screen.queryByRole("button", { name: "filterClear" })).not.toBeInTheDocument();

    rerender(<RouteFilters filters={{ ...base, q: "x" }} assigneeLabel={null} dict={dict} />);
    fireEvent.click(screen.getByRole("button", { name: "filterClear" }));
    expect(replace).toHaveBeenCalledWith("/routes/assign");
  });
});

describe("RouteFilters without the status filter (Add Routes)", () => {
  it("offers only search, assignee, From and To — in that order, in one row", () => {
    const { container } = render(
      <RouteFilters filters={base} assigneeLabel={null} showStatus={false} dict={dict} />,
    );

    expect(screen.queryByLabelText("colStatus")).not.toBeInTheDocument();
    const row = container.firstElementChild as HTMLElement;
    expect(row.className).toContain("lg:flex-nowrap");

    const [from, to] = Array.from(row.querySelectorAll<HTMLInputElement>("input[type='date']"));
    const ordered = [
      screen.getByLabelText("filterSearchPlaceholder"),
      screen.getByPlaceholderText("filterAnyAssignee"),
      from!,
      to!,
    ];
    for (let i = 0; i < ordered.length - 1; i++) {
      expect(ordered[i]!.compareDocumentPosition(ordered[i + 1]!)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }
  });

  it("keeps the same URL behaviour: filter change drops the page, To can't precede From", () => {
    search = "page=4";
    const { container } = render(
      <RouteFilters
        filters={{ ...base, from: "2026-06-20" }}
        assigneeLabel={null}
        showStatus={false}
        dict={dict}
      />,
    );
    const [from, to] = Array.from(
      container.querySelectorAll<HTMLInputElement>("input[type='date']"),
    );

    expect(to).toHaveAttribute("min", "2026-06-20");
    fireEvent.change(from!, { target: { value: "2026-06-22" } });
    expect(replace).toHaveBeenCalledWith("/routes/assign?from=2026-06-22");
  });

  it("doesn't treat a stray status in the URL as an active filter", () => {
    render(
      <RouteFilters
        filters={{ ...base, status: "MISSED" }}
        assigneeLabel={null}
        showStatus={false}
        dict={dict}
      />,
    );

    expect(screen.queryByRole("button", { name: "filterClear" })).not.toBeInTheDocument();
  });
});
