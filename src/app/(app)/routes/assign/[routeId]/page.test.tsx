import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDictionary } from "@/lib/i18n/dictionary";
import type { RouteGroupSummary } from "@/server/services/route-service";

class NotFoundError extends Error {}
const notFound = vi.fn((): never => {
  throw new NotFoundError();
});
vi.mock("next/navigation", () => ({ notFound }));

const requirePermission = vi.fn();
vi.mock("@/server/auth/require-permission", () => ({ requirePermission }));

const getRouteForManagement = vi.fn();
vi.mock("@/server/services/route-service", () => ({ getRouteForManagement }));

vi.mock("@/lib/i18n/server", () => ({
  getServerDictionary: vi.fn(async () => getDictionary("en")),
}));

vi.mock("next/link", () => ({ default: () => null }));
vi.mock("../cancel-assignment-button", () => ({ CancelAssignmentButton: () => null }));
vi.mock("../reassign-form", () => ({ ReassignForm: () => null }));
vi.mock("../route-contents", () => ({ RouteContents: () => null }));

const { default: Page } = await import("./page");

type El = { type?: unknown; props?: Record<string, unknown> };

function findAll(node: unknown, match: (el: El) => boolean, found: El[] = []): El[] {
  if (!node || typeof node !== "object") return found;
  if (Array.isArray(node)) {
    node.forEach((child) => findAll(child, match, found));
    return found;
  }
  const el = node as El;
  if (match(el)) found.push(el);
  findAll(el.props?.children, match, found);
  return found;
}
const byName = (name: string) => (el: El) => typeof el.type === "function" && el.type.name === name;

function route(overrides: Partial<RouteGroupSummary> = {}): RouteGroupSummary {
  return {
    id: "r1",
    code: "RT-00013",
    userId: "d1",
    visitorName: "Delegate User",
    startDate: new Date("2026-10-12T00:00:00.000Z"),
    endDate: new Date("2026-10-17T00:00:00.000Z"),
    status: "ASSIGNED",
    editable: false,
    createdBy: "s1",
    createdByName: "Sup",
    items: [
      {
        id: "i1",
        sequence: 0,
        status: "PENDING",
        center: { id: "c1", name: "A", code: "A", territoryId: "t", typeName: "Clinic" },
        contacts: [],
      },
    ],
    ...overrides,
  };
}

async function render(r: RouteGroupSummary | null) {
  getRouteForManagement.mockResolvedValue(r);
  return Page({ params: Promise.resolve({ routeId: "r1" }) });
}

const text = (node: unknown): string =>
  !node || typeof node !== "object"
    ? typeof node === "string" || typeof node === "number"
      ? String(node)
      : ""
    : Array.isArray(node)
      ? node.map(text).join("")
      : text((node as El).props?.children);

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue({ user: { id: "sup-1", roleName: "SUPERVISOR" } });
});

describe("Route details page", () => {
  it("requires routes:assign-team and loads the route through the same authorization as every action", async () => {
    await render(route());

    expect(requirePermission).toHaveBeenCalledWith("routes:assign-team");
    expect(getRouteForManagement).toHaveBeenCalledWith("r1", "sup-1", "SUPERVISOR");
  });

  it("is not found for a route the actor can't reach", async () => {
    await expect(render(null)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("is not wrapped in a bordered card", async () => {
    const page = await render(route());
    const root = page as El;

    expect(String(root.props?.className)).not.toMatch(/\bborder\b|rounded|shadow/);
  });

  it("shows the code as the heading, the assignee and the date range, with a Back button", async () => {
    const page = await render(route());
    const [h1] = findAll(page, (el) => el.type === "h1");
    const [back] = findAll(page, (el) => typeof el.props?.render === "object");

    expect(text(h1)).toBe("RT-00013");
    expect(text(page)).toContain("Delegate User");
    expect(text(page)).toContain("12/10/2026 – 17/10/2026");
    expect(text(back)).toContain("Back to Assign Routes");
    expect((back!.props!.render as { props: { href: string } }).props.href).toBe("/routes/assign");
  });

  it("offers Cancel Current Assignment in the header while the route is assigned with pending visits", async () => {
    const page = await render(route());

    expect(findAll(page, byName("CancelAssignmentButton"))).toHaveLength(1);
    expect(findAll(page, byName("CancelAssignmentButton"))[0]!.props?.routeId).toBe("r1");
  });

  it("hides cancellation when nothing is pending or the route isn't assigned", async () => {
    const done = await render(route({ items: [{ ...route().items[0]!, status: "COMPLETED" }] }));
    expect(findAll(done, byName("CancelAssignmentButton"))).toHaveLength(0);

    const unassigned = await render(route({ userId: null, visitorName: null }));
    expect(findAll(unassigned, byName("CancelAssignmentButton"))).toHaveLength(0);
  });

  it("puts Centers & Contacts above the Reassign Route section, separated by dividers", async () => {
    const page = await render(route());
    const order = findAll(
      page,
      (el) => el.type === "hr" || byName("RouteContents")(el) || byName("ReassignForm")(el),
    ).map((el) => (typeof el.type === "string" ? el.type : (el.type as { name: string }).name));

    expect(order).toEqual(["hr", "RouteContents", "hr", "ReassignForm"]);
  });

  it("offers reassignment for an assigned route with pending visits and nothing completed", async () => {
    const page = await render(route());
    const [form] = findAll(page, byName("ReassignForm"));

    expect(form!.props).toMatchObject({ routeId: "r1", isAssigned: true });
  });

  it("replaces the form with the completed-work notice once anything is completed", async () => {
    const page = await render(
      route({
        items: [route().items[0]!, { ...route().items[0]!, id: "i2", status: "COMPLETED" }],
      }),
    );

    expect(findAll(page, byName("ReassignForm"))).toHaveLength(0);
    expect(text(page)).toContain("already has completed visits");
    // The remaining pending visit can still be cancelled.
    expect(findAll(page, byName("CancelAssignmentButton"))).toHaveLength(1);
  });

  it("treats a completed contact under a still-pending center as completed work too", async () => {
    const base = route().items[0]!;
    const page = await render(
      route({
        items: [
          {
            ...base,
            contacts: [
              { id: "k", contactId: "p", name: "N", code: "C", status: "COMPLETED", issue: null },
            ],
          },
        ],
      }),
    );

    expect(findAll(page, byName("ReassignForm"))).toHaveLength(0);
  });
});
