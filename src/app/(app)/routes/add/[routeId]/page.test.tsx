import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDictionary } from "@/lib/i18n/dictionary";

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

vi.mock("../enrich-route", () => ({
  getAllTerritoryOptions: vi.fn(async () => []),
  enrichRouteForVisits: vi.fn(async (route: Record<string, unknown>) => ({
    ...route,
    territories: [],
  })),
  toEditorState: vi.fn(() => ({ initialCenters: [], readOnlyItems: [] })),
}));

vi.mock("next/link", () => ({ default: () => null }));
vi.mock("../route-draft-editor", () => ({ RouteDraftEditor: () => null }));
vi.mock("../route-locked-view", () => ({ RouteLockedView: () => null }));

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
const text = (node: unknown): string =>
  !node || typeof node !== "object"
    ? typeof node === "string" || typeof node === "number"
      ? String(node)
      : ""
    : Array.isArray(node)
      ? node.map(text).join("")
      : text((node as El).props?.children);

const route = (editable: boolean) => ({
  id: "r1",
  code: "RT-00005",
  userId: null,
  visitorName: null,
  startDate: null,
  endDate: null,
  status: "UNASSIGNED",
  editable,
  createdBy: "s1",
  createdByName: "Sup",
  items: [],
});

async function render(r: unknown) {
  getRouteForManagement.mockResolvedValue(r);
  return Page({ params: Promise.resolve({ routeId: "r1" }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue({ user: { id: "sup-1", roleName: "SUPERVISOR" } });
});

describe("Edit Route page", () => {
  it("loads only this route, through the same authorization as every action on it", async () => {
    await render(route(true));

    expect(requirePermission).toHaveBeenCalledWith("routes:assign-team");
    expect(getRouteForManagement).toHaveBeenCalledWith("r1", "sup-1", "SUPERVISOR");
  });

  it("is not found for a route the actor can't reach", async () => {
    await expect(render(null)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("has a Back to Add Routes button and an Edit Route heading with the route code", async () => {
    const page = await render(route(true));
    const [h1] = findAll(page, (el) => el.type === "h1");
    const [back] = findAll(page, (el) => typeof el.props?.render === "object");

    expect(text(h1)).toBe("Edit Route");
    expect(text(page)).toContain("RT-00005");
    expect(text(back)).toContain("Back to Add Routes");
    expect((back!.props!.render as { props: { href: string } }).props.href).toBe("/routes/add");
  });

  it("shows the editor while the route is still editable, the read-only view once locked", async () => {
    const editable = await render(route(true));
    expect(findAll(editable, byName("RouteDraftEditor"))).toHaveLength(1);
    expect(findAll(editable, byName("RouteLockedView"))).toHaveLength(0);

    const locked = await render(route(false));
    expect(findAll(locked, byName("RouteLockedView"))).toHaveLength(1);
    expect(findAll(locked, byName("RouteDraftEditor"))).toHaveLength(0);
  });
});
