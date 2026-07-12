import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives inside a multi-implementation repository; pin the
  // workspace root so Turbopack ignores the repository-level lockfile.
  turbopack: { root: __dirname },
};

export default nextConfig;
