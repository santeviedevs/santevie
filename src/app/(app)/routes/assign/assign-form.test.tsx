import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Dictionary } from "@/lib/i18n/dictionary";

const assignRouteAction = vi.fn();
vi.mock("../actions", () => ({ assignRouteAction }));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { AssignForm } = await import("./assign-form");

const dict = new Proxy({}, { get: (_, key) => String(key) }) as Dictionary["routesPage"];

beforeEach(() => {
  vi.clearAllMocks();
  // The comboboxes search on mount; an empty answer is all these tests need.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ routes: [], users: [] }) })),
  );
});

describe("AssignForm", () => {
  it("has the Route and Assign To searches, a Date Range with start and end, and + Add", () => {
    render(<AssignForm minDate="2026-06-15" dict={dict} />);

    expect(screen.getByLabelText("routeFieldLabel")).toBeInTheDocument();
    expect(screen.getByLabelText("assignToLabel")).toBeInTheDocument();
    expect(screen.getByText("dateRangeLabel")).toBeInTheDocument();
    expect(screen.getByLabelText("startDateLabel")).toBeInTheDocument();
    expect(screen.getByLabelText("endDateLabel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "addAction" })).toBeInTheDocument();
  });

  it("won't submit until a route, an assignee and a date range are all chosen", async () => {
    render(<AssignForm minDate="2026-06-15" dict={dict} />);

    fireEvent.click(screen.getByRole("button", { name: "addAction" }));

    expect(await screen.findByText("assignFormIncomplete")).toBeInTheDocument();
    expect(assignRouteAction).not.toHaveBeenCalled();
  });

  it("keeps the earliest selectable start date at today, and the end date at or after the start", () => {
    render(<AssignForm minDate="2026-06-15" dict={dict} />);

    expect(screen.getByLabelText("startDateLabel")).toHaveAttribute("min", "2026-06-15");
    const start = screen.getByLabelText("startDateLabel");
    fireEvent.change(start, { target: { value: "2026-06-20" } });
    expect(screen.getByLabelText("endDateLabel")).toHaveAttribute("min", "2026-06-20");
  });

  it("searches routes and assignees on the server, bounded, rather than preloading them", async () => {
    render(<AssignForm minDate="2026-06-15" dict={dict} />);

    await waitFor(() => {
      const urls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) =>
        String(c[0]),
      );
      expect(urls.some((url) => url.startsWith("/api/routes/assignable-routes"))).toBe(true);
      expect(urls.some((url) => url.startsWith("/api/routes/assignees"))).toBe(true);
    });
  });
});
