import { describe, expect, it } from "vitest";

import nextConfig from "./next.config";

describe("legacy URL redirects", () => {
  it("sends the old Plan Routes URLs and the older /plans ones to /routes/add, permanently", async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    const to = (source: string) => redirects.find((r) => r.source === source);

    expect(to("/routes/plan/:path*")).toMatchObject({
      destination: "/routes/add/:path*",
      permanent: true,
    });
    expect(to("/plans/visits/:path*")).toMatchObject({
      destination: "/routes/add/:path*",
      permanent: true,
    });
    expect(to("/plans/assign/:path*")).toMatchObject({
      destination: "/routes/assign/:path*",
      permanent: true,
    });
    expect(to("/plans")).toMatchObject({ destination: "/visits", permanent: true });
  });

  it("leaves no redirect pointing at the retired /routes/plan address", async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    expect(redirects.filter((r) => r.destination.startsWith("/routes/plan"))).toEqual([]);
  });
});
