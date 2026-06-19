import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root (a stray parent lockfile otherwise confuses Turbopack).
  turbopack: { root: __dirname },
  async rewrites() {
    return [
      // Serve the bundled demo agent's card at the A2A well-known location.
      {
        source: "/.well-known/agent-card.json",
        destination: "/api/demo-agent/card",
      },
    ];
  },
};

export default nextConfig;
