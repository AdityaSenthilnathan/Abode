import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pg` (node-postgres) must not be bundled by Next's server compiler.
  serverExternalPackages: ["pg"],
  // Emit a minimal self-contained server for the Docker image (prod cutover).
  output: "standalone",
};

export default nextConfig;
