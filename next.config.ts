import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // The Visit Plan module moved: its three tabs became Routes (Plan Routes,
  // Assign Routes) and a separate Visits screen.
  async redirects() {
    return [
      { source: "/plans", destination: "/visits", permanent: true },
      { source: "/plans/visits/:path*", destination: "/routes/plan/:path*", permanent: true },
      { source: "/plans/assign/:path*", destination: "/routes/assign/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
