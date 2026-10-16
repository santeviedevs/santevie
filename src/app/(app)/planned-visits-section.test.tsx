import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Dictionary } from "@/lib/i18n/dictionary";
import type { HomeRoutes, RouteGroupSummary } from "@/server/services/route-service";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

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

const { PlannedVisitsSection } = await import("./planned-visits-section");

// Every dictionary key reads back as its own name, so assertions don't
// depend on translated copy.
const dict = new Proxy({}, { get: (_, key) => String(key) }) as Dictionary["routesPage"];

const THIS_WEEK = {
  start: new Date("2026-06-15T00:00:00.000Z"),
  end: new Date("2026-06-21T00:00:00.000Z"),
};
const UPCOMING = {
  start: new Date("2026-06-22T00:00:00.000Z"),
  end: new Date("2026-06-28T00:00:00.000Z"),
};

function route(overrides: Partial<RouteGroupSummary> = {}): RouteGroupSummary {
  return {
    id: "r1",
    assignmentId: "a1",
    code: "RT-00001",
    userId: "delegate-1",
    visitorName: "Dele Gate",
    startDate: new Date("2026-06-19T00:00:00.000Z"),
    endDate: new Date("2026-06-24T00:00:00.000Z"),
    status: "ASSIGNED",
    editable: false,
    createdBy: "s1",
    createdByName: "Sup",
    items: [
      {
        id: "i1",
        sequence: 0,
        status: "PENDING",
        center: {
          id: "c1",
          name: "Alpha Clinic",
          code: "A",
          territoryId: "t",
          typeName: "Clinic",
          territoryPath: "",
        },
        contacts: [
          {
            id: "k1",
            contactId: "p1",
            name: "Dr Bravo",
            code: "CON-1",
            specialization: null,
            status: "PENDING",
            issue: null,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function home(thisWeek: RouteGroupSummary[], upcoming: RouteGroupSummary[]): HomeRoutes {
  return {
    thisWeek: { range: THIS_WEEK, routes: thisWeek },
    upcomingWeek: { range: UPCOMING, routes: upcoming },
  };
}

describe("PlannedVisitsSection", () => {
  it("shows the clear empty state when nothing is assigned for either week", () => {
    render(<PlannedVisitsSection routes={home([], [])} dict={dict} />);

    expect(screen.getByText("noRoutesThisWeekOrNext")).toBeInTheDocument();
    expect(screen.queryByText("thisWeekHeading")).not.toBeInTheDocument();
  });

  it("shows This Week and Upcoming Week as two stacked sections, This Week first", () => {
    render(
      <PlannedVisitsSection
        routes={home([route()], [route({ id: "r2", code: "RT-00002" })])}
        dict={dict}
      />,
    );

    const sections = screen.getAllByRole("region");
    expect(sections.map((section) => section.getAttribute("aria-label"))).toEqual([
      "thisWeekHeading",
      "upcomingWeekHeading",
    ]);
  });

  it("lists a route spanning both weeks, whole, in each section — code and counts, not every center/contact", () => {
    const spanning = route();
    render(<PlannedVisitsSection routes={home([spanning], [spanning])} dict={dict} />);

    for (const section of screen.getAllByRole("region")) {
      expect(within(section).getAllByText("RT-00001").length).toBeGreaterThan(0);
    }
    // The compact table shows counts, never every center/contact name.
    expect(screen.queryByText(/Alpha Clinic/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dr Bravo/)).not.toBeInTheDocument();
  });

  it("says so when only one of the weeks is empty", () => {
    render(<PlannedVisitsSection routes={home([route()], [])} dict={dict} />);

    expect(screen.getByText("noRoutesUpcomingWeek")).toBeInTheDocument();
    expect(screen.queryByText("noRoutesThisWeek")).not.toBeInTheDocument();
  });

  it("shows no status badge and links to the Visits workflow, scoped to the assignment", () => {
    render(
      <PlannedVisitsSection routes={home([route({ status: "IN_PROGRESS" })], [])} dict={dict} />,
    );

    expect(screen.queryByText("statusInProgress")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "openVisits" })).toHaveAttribute("href", "/visits");
    const rowLinks = screen.getAllByRole("link", { name: "RT-00001" });
    for (const link of rowLinks) {
      expect(link).toHaveAttribute("href", "/visits#route-r1");
    }
  });

  it("shows the compact Centers/Contacts count, not an itemized list", () => {
    render(
      <PlannedVisitsSection
        routes={home(
          [
            route({
              items: [
                route().items[0]!,
                {
                  ...route().items[0]!,
                  id: "i2",
                  contacts: [],
                },
              ],
            }),
          ],
          [],
        )}
        dict={dict}
      />,
    );

    expect(
      screen.getAllByText("2 itemsCountSuffix · 1 contactsCountSuffix").length,
    ).toBeGreaterThan(0);
  });
});
