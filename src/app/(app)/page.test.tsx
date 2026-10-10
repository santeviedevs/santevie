import { beforeEach, describe, expect, it, vi } from "vitest";

// redirect() never returns in Next — it throws — so the mock must too, or
// the page would carry on rendering past a redirect.
class RedirectError extends Error {
  constructor(public readonly to: string) {
    super(`redirect:${to}`);
  }
}
const redirect = vi.fn((to: string): never => {
  throw new RedirectError(to);
});
vi.mock("next/navigation", () => ({ redirect }));

const auth = vi.fn();
vi.mock("@/server/auth", () => ({ auth }));

const getMyFollowUps = vi.fn();
vi.mock("@/server/services/follow-up-service", () => ({ getMyFollowUps }));

const getMyRoutesForHome = vi.fn();
vi.mock("@/server/services/route-service", () => ({ getMyRoutesForHome }));

vi.mock("@/lib/i18n/server", () => ({
  getServerDictionary: vi.fn().mockResolvedValue({
    nav: { home: "Home" },
    activitiesPage: { followUpsHeading: "Pending follow-ups", myFollowUps: "My Follow-Ups" },
  }),
}));

vi.mock("./my-routes-section", () => ({ MyRoutesSection: () => null }));

// The widget is a client component with its own server-action imports;
// irrelevant to what's under test here.
vi.mock("./activities/follow-ups-widget", () => ({ FollowUpsWidget: () => null }));

const { default: Home } = await import("./page");

beforeEach(() => {
  vi.clearAllMocks();
});

// Finds an element by its component's name anywhere in the (unrendered)
// element tree a Server Component returns.
function findElement(node: unknown, name: string): { props: Record<string, unknown> } | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, name);
      if (found) return found;
    }
    return null;
  }
  const element = node as { type?: { name?: string }; props?: Record<string, unknown> };
  if (typeof element.type === "function" && element.type.name === name) {
    return element as { props: Record<string, unknown> };
  }
  return findElement(element.props?.children, name);
}

describe("Home", () => {
  it("shows an Admin the home page too — no redirect to the users page any more", async () => {
    auth.mockResolvedValue({
      user: { id: "admin-1", permissions: ["users:manage", "visits:respond-own"] },
    });

    const page = await Home();

    expect(redirect).not.toHaveBeenCalled();
    expect(page).toBeTruthy();
  });

  it("sends a signed-out visitor to login", async () => {
    auth.mockResolvedValue(null);

    await expect(Home()).rejects.toMatchObject({ to: "/login" });
  });

  it("shows everyone else the home page instead of redirecting", async () => {
    auth.mockResolvedValue({
      user: { id: "delegate-1", permissions: ["activities:respond-own"] },
    });

    const page = await Home();

    expect(redirect).not.toHaveBeenCalled();
    expect(page).toBeTruthy();
  });

  it("puts My Routes above the follow-ups, for the signed-in user's own id only", async () => {
    auth.mockResolvedValue({
      user: {
        id: "delegate-1",
        permissions: ["visits:respond-own", "activities:respond-own"],
      },
    });

    const page = await Home();
    const routes = findElement(page, "HomeRoutes");
    const followUps = findElement(page, "HomeFollowUps");

    expect(routes?.props.userId).toBe("delegate-1");
    expect(followUps?.props.userId).toBe("delegate-1");
    const children = (page as { props: { children: unknown[] } }).props.children.flat();
    const order = children
      .filter(Boolean)
      .map((child) => (child as { type?: { name?: string } }).type?.name);
    expect(order.indexOf("HomeRoutes")).toBeLessThan(order.indexOf("HomeFollowUps"));
  });

  it("leaves out My Routes for a user without visits:respond-own", async () => {
    auth.mockResolvedValue({
      user: { id: "someone", permissions: ["activities:respond-own"] },
    });

    const page = await Home();
    expect(findElement(page, "HomeRoutes")).toBeNull();
    expect(findElement(page, "HomeFollowUps")).not.toBeNull();
  });
});
