import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Dictionary } from "@/lib/i18n/dictionary";
import type { HomeRoutes, RouteGroupSummary } from "@/server/services/route-service";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const { MyRoutesSection } = await import("./my-routes-section");

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
        center: { id: "c1", name: "Alpha Clinic", code: "A", territoryId: "t", typeName: "Clinic" },
        contacts: [
          {
            id: "k1",
            contactId: "p1",
            name: "Dr Bravo",
            code: "CON-1",
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

describe("MyRoutesSection", () => {
  it("shows the clear empty state when nothing is assigned for either week", () => {
    render(<MyRoutesSection routes={home([], [])} dict={dict} />);

    expect(screen.getByText("noRoutesThisWeekOrNext")).toBeInTheDocument();
    expect(screen.queryByText("thisWeekHeading")).not.toBeInTheDocument();
  });

  it("shows This Week and Upcoming Week as two stacked sections, This Week first", () => {
    render(
      <MyRoutesSection
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

  it("lists a route spanning both weeks, whole, in each section", () => {
    const spanning = route();
    render(<MyRoutesSection routes={home([spanning], [spanning])} dict={dict} />);

    for (const section of screen.getAllByRole("region")) {
      expect(within(section).getByText("RT-00001")).toBeInTheDocument();
      expect(within(section).getByText(/Alpha Clinic/)).toBeInTheDocument();
      expect(within(section).getByText(/Dr Bravo/)).toBeInTheDocument();
    }
  });

  it("says so when only one of the weeks is empty", () => {
    render(<MyRoutesSection routes={home([route()], [])} dict={dict} />);

    expect(screen.getByText("noRoutesUpcomingWeek")).toBeInTheDocument();
    expect(screen.queryByText("noRoutesThisWeek")).not.toBeInTheDocument();
  });

  it("shows each route's status and links to the Visits workflow", () => {
    render(<MyRoutesSection routes={home([route({ status: "IN_PROGRESS" })], [])} dict={dict} />);

    expect(screen.getByText("statusInProgress")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "openVisits" })).toHaveAttribute("href", "/visits");
  });
});
