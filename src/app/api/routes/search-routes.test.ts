import { beforeEach, describe, expect, it, vi } from "vitest";

class SessionExpiredError extends Error {}
class ForbiddenError extends Error {}

const requirePermission = vi.fn();
vi.mock("@/server/auth/require-permission", () => ({
  requirePermission,
  SessionExpiredError,
  ForbiddenError,
}));

class RouteNotAuthorizedError extends Error {}
class CenterOutsideTerritoryError extends Error {}
class CenterNotFoundError extends Error {}
class InactiveCenterError extends Error {}
const searchCentersForRoute = vi.fn();
const searchContactsForRouteCenter = vi.fn();
const searchAssignableRoutesForActor = vi.fn();
const searchAssigneesForActor = vi.fn();
vi.mock("@/server/services/route-service", () => ({
  RouteNotAuthorizedError,
  CenterOutsideTerritoryError,
  CenterNotFoundError,
  InactiveCenterError,
  searchCentersForRoute,
  searchContactsForRouteCenter,
  searchAssignableRoutesForActor,
  searchAssigneesForActor,
}));

const { GET: searchCenters } = await import("./centers/route");
const { GET: searchAssignableRoutes } = await import("./assignable-routes/route");
const { GET: searchAssignees } = await import("./assignees/route");
const { GET: searchContacts } = await import("./centers/[centerId]/contacts/route");

const SESSION = { user: { id: "u1", roleName: "SUPERVISOR" } };
const contactsParams = (centerId = "center-1") => ({ params: Promise.resolve({ centerId }) });

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue(SESSION);
});

describe("GET /api/routes/centers", () => {
  it("requires routes:assign-team", async () => {
    searchCentersForRoute.mockResolvedValue([]);
    await searchCenters(new Request("http://x/api/routes/centers?q=ab"));
    expect(requirePermission).toHaveBeenCalledWith("routes:assign-team");
  });

  it("returns 401 when the session has expired", async () => {
    requirePermission.mockRejectedValue(new SessionExpiredError());
    const response = await searchCenters(new Request("http://x/api/routes/centers"));
    expect(response.status).toBe(401);
    expect(searchCentersForRoute).not.toHaveBeenCalled();
  });

  it("returns 403 for a role without the permission (e.g. a Delegate)", async () => {
    requirePermission.mockRejectedValue(new ForbiddenError("Missing permission"));
    const response = await searchCenters(new Request("http://x/api/routes/centers"));
    expect(response.status).toBe(403);
    expect(searchCentersForRoute).not.toHaveBeenCalled();
  });

  it("returns 400 for an out-of-range limit instead of throwing", async () => {
    const response = await searchCenters(new Request("http://x/api/routes/centers?limit=999"));
    expect(response.status).toBe(400);
    expect(searchCentersForRoute).not.toHaveBeenCalled();
  });

  it("passes the parsed query and the actor to the service, treating empty params as absent", async () => {
    searchCentersForRoute.mockResolvedValue([{ id: "c1" }]);
    const response = await searchCenters(
      new Request("http://x/api/routes/centers?q=ab&territoryId=&routeId=r1"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ centers: [{ id: "c1" }] });
    expect(searchCentersForRoute).toHaveBeenCalledWith(
      { q: "ab", routeId: "r1", limit: 20 },
      "u1",
      "SUPERVISOR",
    );
  });

  it("maps a route the actor can't act on to 403", async () => {
    searchCentersForRoute.mockRejectedValue(new RouteNotAuthorizedError("no"));
    const response = await searchCenters(new Request("http://x/api/routes/centers?routeId=r1"));
    expect(response.status).toBe(403);
  });
});

describe("GET /api/routes/centers/[centerId]/contacts", () => {
  it("returns 401 / 403 exactly like the center search", async () => {
    requirePermission.mockRejectedValueOnce(new SessionExpiredError());
    expect(
      (
        await searchContacts(
          new Request("http://x/api/routes/centers/c/contacts"),
          contactsParams(),
        )
      ).status,
    ).toBe(401);

    requirePermission.mockRejectedValueOnce(new ForbiddenError("no"));
    expect(
      (
        await searchContacts(
          new Request("http://x/api/routes/centers/c/contacts"),
          contactsParams(),
        )
      ).status,
    ).toBe(403);
    expect(searchContactsForRouteCenter).not.toHaveBeenCalled();
  });

  it("searches the requested center only", async () => {
    searchContactsForRouteCenter.mockResolvedValue([]);
    const response = await searchContacts(
      new Request("http://x/api/routes/centers/center-9/contacts?q=dr"),
      contactsParams("center-9"),
    );
    expect(response.status).toBe(200);
    expect(searchContactsForRouteCenter).toHaveBeenCalledWith(
      "center-9",
      { q: "dr", limit: 20 },
      "u1",
      "SUPERVISOR",
    );
  });

  it("maps a center outside the actor's territories to 403 and an unknown one to 404", async () => {
    searchContactsForRouteCenter.mockRejectedValueOnce(new CenterOutsideTerritoryError("no"));
    expect(
      (
        await searchContacts(
          new Request("http://x/api/routes/centers/c/contacts"),
          contactsParams(),
        )
      ).status,
    ).toBe(403);

    searchContactsForRouteCenter.mockRejectedValueOnce(new CenterNotFoundError("none"));
    expect(
      (
        await searchContacts(
          new Request("http://x/api/routes/centers/c/contacts"),
          contactsParams(),
        )
      ).status,
    ).toBe(404);
  });

  it("returns 400 for a bad limit", async () => {
    const response = await searchContacts(
      new Request("http://x/api/routes/centers/c/contacts?limit=0"),
      contactsParams(),
    );
    expect(response.status).toBe(400);
  });
});

describe.each([
  [
    "GET /api/routes/assignable-routes",
    searchAssignableRoutes,
    searchAssignableRoutesForActor,
    "routes",
    "assignable-routes",
  ],
  ["GET /api/routes/assignees", searchAssignees, searchAssigneesForActor, "users", "assignees"],
] as const)("%s", (_name, handler, service, key, path) => {
  const url = (query = "") => new Request(`http://x/api/routes/${path}${query}`);

  it("requires routes:assign-team — a Delegate gets 403, an expired session 401", async () => {
    requirePermission.mockRejectedValueOnce(new ForbiddenError("no"));
    expect((await handler(url())).status).toBe(403);

    requirePermission.mockRejectedValueOnce(new SessionExpiredError());
    expect((await handler(url())).status).toBe(401);

    expect(service).not.toHaveBeenCalled();
    expect(requirePermission).toHaveBeenCalledWith("routes:assign-team");
  });

  it("returns 400 for an out-of-range limit instead of throwing", async () => {
    expect((await handler(url("?limit=999"))).status).toBe(400);
    expect(service).not.toHaveBeenCalled();
  });

  it("searches as the signed-in user with the parsed, bounded query", async () => {
    service.mockResolvedValue([{ id: "x" }]);

    const response = await handler(url("?q=ab"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ [key]: [{ id: "x" }] });
    expect(service).toHaveBeenCalledWith({ q: "ab", limit: 20 }, "u1", "SUPERVISOR");
  });
});
