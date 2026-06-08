import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pg` (node-postgres) must not be bundled by Next's server compiler.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
