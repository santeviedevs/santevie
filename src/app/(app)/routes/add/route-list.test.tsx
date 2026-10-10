import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDictionary } from "@/lib/i18n/dictionary";
import type { RouteGroupSummary } from "@/server/services/route-service";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
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

const { RouteList } = await import("./route-list");

const dict = getDictionary("en").routesPage;

function contact(n: number, status: "PENDING" | "COMPLETED" | "CANCELLED" | "MISSED") {
  return {
    id: `k${n}`,
    contactId: `p${n}`,
    name: `Person ${n}`,
    code: `P${n}`,
    roleName: null,
    specialization: null,
    status,
    issue: null,
  };
}

function item(n: number, contacts: ReturnType<typeof contact>[]) {
  return {
    id: `i${n}`,
    sequence: n,
    status: "PENDING" as const,
    center: {
      id: `c${n}`,
      name: `Center ${n}`,
      code: `C${n}`,
      territoryId: "t",
      typeName: "Clinic",
      territoryPath: "",
    },
    contacts,
  };
}

function route(overrides: Partial<RouteGroupSummary> = {}): RouteGroupSummary {
  return {
    id: "r1",
    code: "RT-00014",
    userId: "u1",
    visitorName: "Supervisor User",
    startDate: new Date("2026-10-12T00:00:00.000Z"),
    endDate: new Date("2026-10-17T00:00:00.000Z"),
    status: "ASSIGNED",
    editable: false,
    createdBy: "s1",
    createdByName: "Sup",
    items: [
      item(1, [contact(1, "COMPLETED"), contact(2, "PENDING")]),
      item(2, [contact(3, "PENDING"), contact(4, "PENDING")]),
    ],
    ...overrides,
  };
}

const unassigned = () =>
  route({
    id: "r2",
    code: "RT-00012",
    userId: null,
    visitorName: null,
    startDate: null,
    endDate: null,
    status: "UNASSIGNED",
    editable: true,
    items: [item(1, [contact(1, "PENDING")])],
  });

beforeEach(() => vi.clearAllMocks());

describe("Add Routes list", () => {
  it("shows the empty message when there are no routes", () => {
    render(<RouteList routes={[]} dict={dict} />);
    expect(screen.getByText("No routes yet.")).toBeInTheDocument();
  });

  it("has the agreed columns and no Actions column", () => {
    const { container } = render(<RouteList routes={[route()]} dict={dict} />);
    const headers = within(container.querySelector("table") as HTMLElement).getAllByRole(
      "columnheader",
    );

    expect(headers.map((h) => h.textContent)).toEqual([
      "Route",
      "Assigned To",
      "Assignment Period",
      "Centers",
      "Contacts",
    ]);
  });

  it("shows the code with its status, the assignee, the period, the centers and the contacts", () => {
    const { container } = render(<RouteList routes={[route()]} dict={dict} />);
    const row = within(container.querySelector("table tbody tr") as HTMLElement);

    expect(row.getByText("RT-00014")).toBeInTheDocument();
    expect(row.getByText("Assigned")).toBeInTheDocument();
    expect(row.getByText("Supervisor User")).toBeInTheDocument();
    expect(row.getByText("12/10/2026 – 17/10/2026")).toBeInTheDocument();
    expect(row.getByText("2 centers")).toBeInTheDocument();
    expect(row.getByText("4 contacts")).toBeInTheDocument();
  });

  it("summarises contact statuses, listing only the ones that occur", () => {
    const { container } = render(<RouteList routes={[route()]} dict={dict} />);
    expect(
      within(container.querySelector("table tbody tr") as HTMLElement).getByText(
        "(1 completed · 3 pending)",
      ),
    ).toBeInTheDocument();

    const all = route({
      id: "r3",
      items: [item(1, [contact(1, "MISSED"), contact(2, "CANCELLED")])],
    });
    const second = render(<RouteList routes={[all]} dict={dict} />);
    expect(
      within(second.container.querySelector("table tbody tr") as HTMLElement).getByText(
        "(1 missed · 1 cancelled)",
      ),
    ).toBeInTheDocument();
  });

  it("clearly marks a route nobody holds yet: Unassigned, with dashes for assignee and period", () => {
    const { container } = render(<RouteList routes={[unassigned()]} dict={dict} />);
    const row = container.querySelector("table tbody tr") as HTMLElement;
    const cells = within(row).getAllByRole("cell");

    expect(within(row).getByText("Unassigned")).toBeInTheDocument();
    expect(cells[1]).toHaveTextContent("—");
    expect(cells[2]).toHaveTextContent("—");
  });

  it("has no Edit button — the code is the link, and the whole row opens the route", () => {
    const { container } = render(<RouteList routes={[route()]} dict={dict} />);
    const body = within(container.querySelector("table tbody") as HTMLElement);

    expect(body.queryByRole("button")).not.toBeInTheDocument();
    expect(body.queryByText("Edit")).not.toBeInTheDocument();
    expect(body.getByRole("link", { name: "RT-00014" })).toHaveAttribute("href", "/routes/add/r1");

    fireEvent.click(body.getByText("Supervisor User"));
    expect(push).toHaveBeenCalledWith("/routes/add/r1");
  });

  it("is a plain table with no card border, and visibly interactive on hover", () => {
    const { container } = render(<RouteList routes={[route()]} dict={dict} />);
    const wrapper = container.querySelector("div.hidden.md\\:block") as HTMLElement;
    const row = container.querySelector("table tbody tr") as HTMLElement;

    expect(wrapper.className).not.toMatch(/\bborder\b|rounded/);
    expect(row.className).toContain("cursor-pointer");
    expect(row.className).toContain("hover:bg-muted/50");
  });

  it("renders stacked rows for small screens, each one link to the same page", () => {
    const { container } = render(<RouteList routes={[route()]} dict={dict} />);
    const card = within(container.querySelector("ul.md\\:hidden") as HTMLElement).getByRole("link");

    expect(card).toHaveAttribute("href", "/routes/add/r1");
    expect(card).toHaveTextContent("RT-00014");
    expect(card).toHaveTextContent("Supervisor User");
  });
});
