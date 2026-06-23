#!/usr/bin/env node
// Connectivity check for the Abode dev Aurora cluster.
//
// Confirms the dev machine can actually reach + authenticate to Postgres — the
// thing that breaks when the public IP rotates out of the Aurora security
// group allowlist and makes dev login hang. Run it after fixing the security
// group to prove the fix end-to-end, or up front to confirm the diagnosis.
//
// Usage:  node .claude/skills/fix-dev-login/scripts/check-db.mjs
// Exit:   0 = DB reachable + query OK,  1 = unreachable/failed (see message).

import { readFileSync } from "node:fs";
import net from "node:net";
import pg from "pg";

const root = process.cwd();
let url;
try {
  const env = readFileSync(`${root}/.env.local`, "utf8");
  url = env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
} catch {
  console.error("✗ could not read ./.env.local — run from the repo root (try `bash infra/write_env.sh` if it's missing)");
  process.exit(1);
}
if (!url) {
  console.error("✗ DATABASE_URL not found in .env.local");
  process.exit(1);
}

const host = new URL(url).hostname;
const port = Number(new URL(url).port || 5432);

// 1) Show the IP the SG needs to allow, so a mismatch is obvious at a glance.
try {
  const res = await fetch("https://checkip.amazonaws.com", { signal: AbortSignal.timeout(8000) });
  console.log(`  public IP (must be in the Aurora SG): ${(await res.text()).trim()}`);
} catch {
  console.log("  public IP: (could not determine — offline?)");
}

// 2) Raw TCP reachability. A timeout here == the SG is blocking you.
const tcpOk = await new Promise((resolve) => {
  const t0 = Date.now();
  const s = net.createConnection({ host, port, timeout: 12000 });
  s.on("connect", () => { console.log(`  TCP ${host}:${port} open in ${Date.now() - t0}ms`); s.destroy(); resolve(true); });
  s.on("timeout", () => { console.error(`✗ TCP ${host}:${port} timed out after 12s — IP is NOT in the Aurora security group`); s.destroy(); resolve(false); });
  s.on("error", (e) => { console.error(`✗ TCP ${host}:${port} failed: ${e.message}`); resolve(false); });
});
if (!tcpOk) {
  console.error("\n→ Fix: bash infra/02_security_groups.sh   (auto-detects + allowlists your current IP)");
  process.exit(1);
}

// 3) Authenticate + run a trivial query (proves creds + TLS, not just the port).
const pool = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 15000, ssl: { rejectUnauthorized: false } });
const t0 = Date.now();
try {
  const r = await pool.query("select current_user");
  console.log(`✓ DB query OK in ${Date.now() - t0}ms (current_user=${r.rows[0].current_user}) — sign-in should work`);
  process.exit(0);
} catch (e) {
  console.error(`✗ DB query failed in ${Date.now() - t0}ms: ${e.message}`);
  console.error("→ Port was open but auth/TLS failed. Refresh creds: bash infra/write_env.sh");
  process.exit(1);
} finally {
  await pool.end();
}
