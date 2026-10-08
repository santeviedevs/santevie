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

vi.mock("@/lib/i18n/server", () => ({
  getServerDictionary: vi.fn().mockResolvedValue({
    nav: { home: "Home" },
    activitiesPage: { followUpsHeading: "Pending follow-ups", myFollowUps: "My Follow-Ups" },
  }),
}));

// The widget is a client component with its own server-action imports;
// irrelevant to what's under test here.
vi.mock("./activities/follow-ups-widget", () => ({ FollowUpsWidget: () => null }));

const { default: Home } = await import("./page");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Home", () => {
  it("sends a user who administers users to the admin users page, as before", async () => {
    auth.mockResolvedValue({ user: { id: "admin-1", permissions: ["users:manage"] } });

    await expect(Home()).rejects.toMatchObject({ to: "/admin/users" });
    expect(getMyFollowUps).not.toHaveBeenCalled();
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
});
