import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Dictionary } from "@/lib/i18n/dictionary";
import type { RouteGroupSummary } from "@/server/services/route-service";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// jsdom has no ResizeObserver, which the table's scroll container expects.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const { RoutesTable } = await import("./routes-table");
const { ClickableTableRow } = await import("@/components/clickable-table-row");

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const dict = new Proxy({}, { get: (_, key) => String(key) }) as Dictionary["routesPage"];

function item(status: "PENDING" | "COMPLETED" | "CANCELLED" | "MISSED", n = 1) {
  return {
    id: `i${n}`,
    sequence: n,
    status,
    center: {
      id: `c${n}`,
      name: `Center ${n}`,
      code: `C${n}`,
      territoryId: "t",
      typeName: "Clinic",
      territoryPath: "",
    },
    contacts: [
      {
        id: `k${n}`,
        contactId: `p${n}`,
        name: `Person ${n}`,
        code: "P",
        roleName: null,
        specialization: null,
        status,
        issue: null,
      },
    ],
  };
}

function route(overrides: Partial<RouteGroupSummary> = {}): RouteGroupSummary {
  return {
    id: "r1",
    code: "RT-00001",
    userId: "d1",
    visitorName: "Dele Gate",
    startDate: new Date("2026-06-16T00:00:00.000Z"),
    endDate: new Date("2026-06-22T00:00:00.000Z"),
    status: "ASSIGNED",
    editable: true,
    createdBy: "s1",
    createdByName: "Sup",
    items: [item("PENDING", 1), item("PENDING", 2)],
    ...overrides,
  };
}

describe("RoutesTable", () => {
  it("shows the empty message when there are no routes", () => {
    render(<RoutesTable routes={[]} dict={dict} emptyLabel="nothing here" />);
    expect(screen.getByText("nothing here")).toBeInTheDocument();
  });

  it("has the agreed columns", () => {
    const { container } = render(<RoutesTable routes={[route()]} dict={dict} emptyLabel="" />);
    const headers = within(container.querySelector("table")!).getAllByRole("columnheader");

    expect(headers.map((h) => h.textContent)).toEqual([
      "colRoute",
      "colCentersContacts",
      "colAssignedTo",
      "colDateRange",
      "colStatus",
    ]);
  });

  it("shows the code, centers and contacts counts, assignee, date range and status", () => {
    const { container } = render(
      <RoutesTable
        routes={[
          route({
            userId: "d1",
            visitorName: "Dele Gate",
            startDate: new Date("2026-06-16T00:00:00.000Z"),
            endDate: new Date("2026-06-22T00:00:00.000Z"),
            status: "ASSIGNED",
          }),
        ]}
        dict={dict}
        emptyLabel=""
      />,
    );
    const row = within(container.querySelector("table tbody tr") as HTMLElement);

    expect(row.getByText("RT-00001")).toBeInTheDocument();
    expect(row.getByText("2 itemsCountSuffix · 2 contactsCountSuffix")).toBeInTheDocument();
    expect(row.getByText("Dele Gate")).toBeInTheDocument();
    expect(row.getByText("16/06/2026 – 22/06/2026")).toBeInTheDocument();
    expect(row.getByText("statusAssigned")).toBeInTheDocument();
  });

  it("has no Actions column and no per-row buttons", () => {
    const { container } = render(<RoutesTable routes={[route()]} dict={dict} emptyLabel="" />);

    expect(screen.queryByText("colActions")).not.toBeInTheDocument();
    expect(
      within(container.querySelector("table tbody") as HTMLElement).queryAllByRole("button"),
    ).toEqual([]);
  });

  it("links every row to the route's Manage page through its code, for keyboard and screen readers", () => {
    const { container } = render(<RoutesTable routes={[route()]} dict={dict} emptyLabel="" />);
    const link = within(container.querySelector("table tbody") as HTMLElement).getByRole("link", {
      name: "RT-00001",
    });

    expect(link).toHaveAttribute("href", "/routes/assign/r1");
  });

  it("opens the detail view when the row is clicked anywhere", () => {
    const { container } = render(<RoutesTable routes={[route()]} dict={dict} emptyLabel="" />);

    fireEvent.click(
      within(container.querySelector("table tbody tr") as HTMLElement).getByText("Dele Gate"),
    );
    expect(push).toHaveBeenCalledWith("/routes/assign/r1");
  });

  it("is visibly interactive: a pointer cursor and a hover highlight", () => {
    const { container } = render(<RoutesTable routes={[route()]} dict={dict} emptyLabel="" />);
    const row = container.querySelector("table tbody tr") as HTMLElement;

    expect(row.className).toContain("cursor-pointer");
    expect(row.className).toContain("hover:bg-muted/50");
  });

  it("lets a click on the link itself do its own navigation, not also the row's", () => {
    const { container } = render(<RoutesTable routes={[route()]} dict={dict} emptyLabel="" />);

    fireEvent.click(
      within(container.querySelector("table tbody") as HTMLElement).getByRole("link"),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("leaves a click on any nested interactive element alone", () => {
    render(
      <table>
        <tbody>
          <ClickableTableRow href="/x">
            <td>
              <button type="button">inner</button>
              <input aria-label="field" />
            </td>
          </ClickableTableRow>
        </tbody>
      </table>,
    );

    fireEvent.click(screen.getByRole("button", { name: "inner" }));
    fireEvent.click(screen.getByLabelText("field"));
    expect(push).not.toHaveBeenCalled();
  });

  it("doesn't navigate when the user is selecting text", () => {
    const { container } = render(<RoutesTable routes={[route()]} dict={dict} emptyLabel="" />);
    vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "RT-0" } as Selection);

    fireEvent.click(
      within(container.querySelector("table tbody tr") as HTMLElement).getByText("Dele Gate"),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("makes each stacked card on small screens one link to the same page", () => {
    const { container } = render(<RoutesTable routes={[route()]} dict={dict} emptyLabel="" />);
    const card = within(container.querySelector("ul.md\\:hidden") as HTMLElement).getByRole("link");

    expect(card).toHaveAttribute("href", "/routes/assign/r1");
    expect(card).toHaveTextContent("RT-00001");
  });

  it("falls back to dashes if a row has no assignee or range", () => {
    const { container } = render(
      <RoutesTable
        routes={[route({ userId: null, visitorName: null, startDate: null, endDate: null })]}
        dict={dict}
        emptyLabel=""
      />,
    );
    const cells = within(container.querySelector("table tbody tr") as HTMLElement).getAllByRole(
      "cell",
    );

    expect(cells[2]).toHaveTextContent("—");
    expect(cells[3]).toHaveTextContent("—");
  });

  it("renders a stacked list for small screens alongside the table, so phones don't scroll sideways", () => {
    const { container } = render(<RoutesTable routes={[route()]} dict={dict} emptyLabel="" />);

    expect(container.querySelector("ul.md\\:hidden")).not.toBeNull();
    expect(container.querySelector(".hidden.md\\:block table")).not.toBeNull();
  });
});
