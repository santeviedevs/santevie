import { describe, expect, it, vi } from "vitest";

const redirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect }));

const { default: Home } = await import("./page");

describe("Home", () => {
  it("redirects to the admin users page", () => {
    Home();
    expect(redirect).toHaveBeenCalledWith("/admin/users");
  });
});
