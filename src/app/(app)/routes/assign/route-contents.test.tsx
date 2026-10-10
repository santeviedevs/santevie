import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getDictionary } from "@/lib/i18n/dictionary";
import type { RouteItemSummary } from "@/server/services/route-service";

import { RouteContents } from "./route-contents";

const dict = getDictionary("en").routesPage;

function item(overrides: Partial<RouteItemSummary> = {}): RouteItemSummary {
  return {
    id: "i1",
    sequence: 0,
    status: "PENDING",
    center: {
      id: "c1",
      name: "Sample Clinic",
      code: "CL-HOSP-0001",
      territoryId: "t",
      typeName: "Hospital",
      territoryPath: "",
    },
    contacts: [
      {
        id: "k1",
        contactId: "p1",
        name: "Dr. Harsh Kumar",
        code: "CL-001",
        roleName: null,
        specialization: null,
        status: "PENDING",
        issue: null,
      },
    ],
    ...overrides,
  };
}

describe("RouteContents", () => {
  it("has the Centers & Contacts heading and a compact count summary", () => {
    render(
      <RouteContents
        items={[
          item(),
          item({
            id: "i2",
            center: {
              id: "c2",
              name: "Sample Doctor",
              code: "CL-0001",
              territoryId: "t",
              typeName: "Doctor",
              territoryPath: "",
            },
            contacts: [
              {
                id: "k2",
                contactId: "p2",
                name: "Dr. Priya",
                code: "CL-002",
                roleName: null,
                specialization: null,
                status: "PENDING",
                issue: null,
              },
              {
                id: "k3",
                contactId: "p3",
                name: "Dr. Rahul",
                code: "CL-003",
                roleName: null,
                specialization: null,
                status: "COMPLETED",
                issue: null,
              },
            ],
          }),
        ]}
        dict={dict}
      />,
    );

    expect(screen.getByRole("heading", { name: "Centers & Contacts" })).toBeInTheDocument();
    expect(screen.getByText("2 centers · 3 contacts")).toBeInTheDocument();
  });

  it("shows each center's name, code and type", () => {
    render(<RouteContents items={[item()]} dict={dict} />);

    expect(screen.getByText("Sample Clinic")).toBeInTheDocument();
    expect(screen.getByText("(CL-HOSP-0001)")).toBeInTheDocument();
    expect(screen.getByText("Hospital")).toBeInTheDocument();
  });

  it("nests each contact under its own center, with name and code", () => {
    const { container } = render(
      <RouteContents
        items={[
          item(),
          item({
            id: "i2",
            center: {
              id: "c2",
              name: "Other",
              code: "O-1",
              territoryId: "t",
              typeName: "Clinic",
              territoryPath: "",
            },
            contacts: [
              {
                id: "k2",
                contactId: "p2",
                name: "Dr. Priya",
                code: "CL-002",
                roleName: null,
                specialization: null,
                status: "PENDING",
                issue: null,
              },
            ],
          }),
        ]}
        dict={dict}
      />,
    );
    const [first, second] = Array.from(
      container.querySelectorAll<HTMLElement>("section > ul > li"),
    );

    expect(within(first!).getByText("Dr. Harsh Kumar")).toBeInTheDocument();
    expect(within(first!).queryByText("Dr. Priya")).not.toBeInTheDocument();
    expect(within(second!).getByText("Dr. Priya")).toBeInTheDocument();
    expect(within(second!).getByText("(CL-002)")).toBeInTheDocument();
  });

  it("shows status badges for the center and each contact", () => {
    render(
      <RouteContents
        items={[
          item({
            status: "COMPLETED",
            contacts: [
              {
                id: "k1",
                contactId: "p1",
                name: "A",
                code: "A1",
                roleName: null,
                specialization: null,
                status: "COMPLETED",
                issue: null,
              },
              {
                id: "k2",
                contactId: "p2",
                name: "B",
                code: "B1",
                roleName: null,
                specialization: null,
                status: "CANCELLED",
                issue: null,
              },
            ],
          }),
        ]}
        dict={dict}
      />,
    );

    expect(screen.getAllByText("COMPLETED")).toHaveLength(2);
    expect(screen.getByText("CANCELLED")).toBeInTheDocument();
  });

  it("separates rows with dividers, not card borders", () => {
    const { container } = render(
      <RouteContents items={[item(), item({ id: "i2" })]} dict={dict} />,
    );
    const list = container.querySelector("section > ul") as HTMLElement;

    expect(list.className).toContain("divide-y");
    for (const li of list.children) {
      expect(li.className).not.toMatch(/\bborder\b|rounded/);
    }
  });

  it("flags a contact whose link to the center was removed, but keeps it listed", () => {
    render(
      <RouteContents
        items={[
          item({
            contacts: [
              {
                id: "k1",
                contactId: "p1",
                name: "Gone",
                code: "G1",
                roleName: null,
                specialization: null,
                status: "PENDING",
                issue: "NOT_ASSOCIATED",
              },
            ],
          }),
        ]}
        dict={dict}
      />,
    );

    expect(screen.getByText("Gone")).toBeInTheDocument();
    expect(screen.getByText("No longer associated")).toBeInTheDocument();
  });

  it("copes with a center that has no contacts", () => {
    render(<RouteContents items={[item({ contacts: [] })]} dict={dict} />);

    expect(screen.getByText("Sample Clinic")).toBeInTheDocument();
    expect(screen.getByText("1 centers · 0 contacts")).toBeInTheDocument();
  });

  it("says so when the route has no centers", () => {
    render(<RouteContents items={[]} dict={dict} />);
    expect(screen.getByText("No centers added yet.")).toBeInTheDocument();
  });
});
