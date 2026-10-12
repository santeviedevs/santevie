import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDictionary } from "@/lib/i18n/dictionary";

const requirePermission = vi.fn();
vi.mock("@/server/auth/require-permission", () => ({ requirePermission }));

const listRoutesForContent = vi.fn();
const getAssigneeFilterLabel = vi.fn();
vi.mock("@/server/services/route-service", () => ({
  listRoutesForContent,
  getAssigneeFilterLabel,
}));

vi.mock("@/lib/i18n/server", () => ({
  getServerDictionary: vi.fn(async () => getDictionary("en")),
}));

vi.mock("next/link", () => ({ default: () => null }));
vi.mock("@/components/pagination-controls", () => ({ PaginationControls: () => null }));
vi.mock("../route-tabs", () => ({ RouteTabs: () => null }));
vi.mock("../route-filters", () => ({ RouteFilters: () => null }));
vi.mock("./route-list", () => ({ RouteList: () => null }));

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

async function render(searchParams: Record<string, string> = {}) {
  return Page({ searchParams: Promise.resolve(searchParams) });
}

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue({ user: { id: "sup-1", roleName: "SUPERVISOR" } });
  listRoutesForContent.mockResolvedValue({ items: [], total: 23, page: 1, pageSize: 10 });
});

describe("Add Routes page", () => {
  it("requires routes:assign-team and lists the actor's routes through the service", async () => {
    await render();

    expect(requirePermission).toHaveBeenCalledWith("routes:assign-team");
    expect(listRoutesForContent).toHaveBeenCalledWith(
      { page: 1, pageSize: 10 },
      "sup-1",
      "SUPERVISOR",
    );
  });

  it("has search, assignee and date-range filters only — no status filter", async () => {
    const page = await render();
    const [filters] = findAll(page, byName("RouteFilters"));

    expect(filters!.props).toMatchObject({ showStatus: false });
  });

  it("reads the filters from the URL and hands them to the service", async () => {
    await render({
      q: " RT-1 ",
      assigneeId: "u1",
      from: "2026-06-01",
      to: "2026-06-30",
      page: "2",
    });

    expect(listRoutesForContent).toHaveBeenCalledWith(
      { q: "RT-1", assigneeId: "u1", from: "2026-06-01", to: "2026-06-30", page: 2, pageSize: 10 },
      "sup-1",
      "SUPERVISOR",
    );
  });

  it("resolves the selected assignee's name for the filter, within the actor's reach", async () => {
    getAssigneeFilterLabel.mockResolvedValue("Jo (E1)");
    const page = await render({ assigneeId: "u1" });
    const [filters] = findAll(page, byName("RouteFilters"));

    expect(getAssigneeFilterLabel).toHaveBeenCalledWith("u1", "sup-1", "SUPERVISOR");
    expect(filters!.props).toMatchObject({ assigneeLabel: "Jo (E1)" });
  });

  it("doesn't look an assignee up when none is selected", async () => {
    await render();
    expect(getAssigneeFilterLabel).not.toHaveBeenCalled();
  });

  it("uses a 'no routes match' message when filters are active, the plain one otherwise", async () => {
    const plain = await render();
    expect(findAll(plain, byName("RouteList"))[0]!.props!.emptyLabel).toBe("No routes yet.");

    const filtered = await render({ q: "zzz" });
    expect(findAll(filtered, byName("RouteList"))[0]!.props!.emptyLabel).toBe(
      "No routes match these filters.",
    );
  });

  it("keeps the tabs on top, with the Add Routes tab active", async () => {
    const page = await render();
    const [tabs] = findAll(page, byName("RouteTabs"));

    expect(tabs!.props).toMatchObject({ active: "route" });
  });

  it("has a simple 'Routes' heading and an Add Route button to the new-route page", async () => {
    const page = await render();
    const [h1] = findAll(page, (el) => el.type === "h1");
    const [button] = findAll(page, (el) => typeof el.props?.render === "object");

    expect(text(h1)).toBe("Routes");
    expect(text(button)).toBe("Add Route");
    expect((button!.props!.render as { props: { href: string } }).props.href).toBe(
      "/routes/add/new",
    );
  });

  it("paginates on the server from the URL, and tells the controls the total", async () => {
    listRoutesForContent.mockResolvedValue({ items: [], total: 23, page: 2, pageSize: 10 });
    const page = await render({ page: "2" });
    const [controls] = findAll(page, byName("PaginationControls"));

    expect(listRoutesForContent).toHaveBeenCalledWith(
      { page: 2, pageSize: 10 },
      "sup-1",
      "SUPERVISOR",
    );
    expect(controls!.props).toMatchObject({ page: 2, pageSize: 10, total: 23 });
    expect(controls!.props!.pageInfoLabel).toBe("Page 2 of 3 (23 total)");
  });

  it("copes with a malformed page or an oversized page size", async () => {
    await render({ page: "-4", pageSize: "100000" });

    const [params] = listRoutesForContent.mock.calls[0]!;
    expect(params.page).toBe(1);
    expect(params.pageSize).toBeLessThanOrEqual(100);
  });
});
