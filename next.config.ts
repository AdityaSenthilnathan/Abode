import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pg` (node-postgres) must not be bundled by Next's server compiler.
  serverExternalPackages: ["pg"],
  // Emit a minimal self-contained server for the Docker image (prod cutover).
  output: "standalone",
  // Build output dir. Overridable so a local production preview can build into
  // its own dir (`.next-prod`) instead of fighting `next dev`, which is
  // continuously rewriting `.next`. See scripts/preview.sh.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
