#!/usr/bin/env bash
set -euo pipefail

# Local production preview for Abode.
#
# Why this exists instead of `next start`:
#   1. next.config.ts sets `output: "standalone"` (so the Docker prod image is a
#      minimal self-contained server). `next start` does NOT work with that — a
#      standalone build's static assets 400, so the app loads unstyled and
#      non-interactive. The supported path is to run the emitted standalone
#      server, but Next doesn't copy `public/` or the static dir into it. So we
#      build, copy those assets next to server.js, then run it.
#   2. It builds into its OWN dir (.next-prod) via NEXT_DIST_DIR, so it never
#      fights `next dev`, which is continuously rewriting `.next`. That means you
#      can keep `npm run dev` running on :3000 and preview prod on :3001.
#
# Unlike `next dev`, this has <Link> prefetch and production optimizations on,
# so tab-to-tab navigation feels like real production (not the dev compile lag).
#
#   npm run preview            # build + serve on http://localhost:3001
#   PORT=4000 npm run preview  # override the port

# Run from the repo root and make the local `next` binary resolvable even if
# this script is invoked directly (not via `npm run`).
cd "$(dirname "$0")/.."
export PATH="$PWD/node_modules/.bin:$PATH"

DIST="${NEXT_DIST_DIR:-.next-prod}"
export NEXT_DIST_DIR="$DIST"
PORT="${PORT:-3001}"

echo "▸ Building production bundle into $DIST/ (separate from dev's .next)…"
next build

echo "▸ Copying static assets into the standalone server…"
rm -rf "$DIST/standalone/public" "$DIST/standalone/$DIST/static"
cp -R public "$DIST/standalone/public"
cp -R "$DIST/static" "$DIST/standalone/$DIST/static"

echo "▸ Serving production build on http://localhost:$PORT  (Ctrl-C to stop)"
# The standalone server does NOT auto-load .env files at runtime (real prod
# injects env into the container directly). Feed .env.local in so server-side
# vars — DATABASE_URL, ALLOW_DEMO_LOGIN, Cognito, etc. — are present at runtime,
# otherwise dynamic pages bounce to /login. NODE_ENV stays "production" (the
# server sets it; .env.local doesn't override it).
if [ -f .env.local ]; then
  PORT="$PORT" exec node --env-file=.env.local "$DIST/standalone/server.js"
else
  PORT="$PORT" exec node "$DIST/standalone/server.js"
fi
