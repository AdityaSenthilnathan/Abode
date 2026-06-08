/**
 * Runtime smoke test (Node fetch — no curl needed). Assumes `npm run dev` is
 * starting/running on :3000. Logs in as each seeded role via the dev cookie and
 * asserts pages return 200 and contain expected content.
 *   npx tsx scripts/smoke.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { Pool } from "pg";

const BASE = "http://localhost:3000";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitReady() {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(1000);
  }
  throw new Error("dev server never became ready");
}

async function userIds(): Promise<Record<string, string>> {
  const pg = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
  });
  const rows = (await pg.query("select email, id from users")).rows as { email: string; id: string }[];
  await pg.end();
  return Object.fromEntries(rows.map((r) => [r.email, r.id]));
}

let failures = 0;
async function check(cookieId: string, path: string, expects: string[]) {
  let status = 0;
  let html = "";
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { cookie: `abode_dev_user=${cookieId}` },
      redirect: "manual",
    });
    status = res.status;
    if (status === 200) html = (await res.text()).toLowerCase();
  } catch (e) {
    console.log(`✗ ${path} — fetch error: ${(e as Error).message}`);
    failures++;
    return;
  }
  const missing = expects.filter((e) => !html.includes(e.toLowerCase()));
  const ok = status === 200 && missing.length === 0;
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${path} [${status}]${missing.length ? "  MISSING: " + missing.join(", ") : ""}`);
}

async function firstTaskId(handymanId: string): Promise<string | null> {
  const pg = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
  });
  const r = await pg.query("select id from tasks where assigned_to=$1 order by created_at desc limit 1", [handymanId]);
  await pg.end();
  return r.rows[0]?.id ?? null;
}

async function main() {
  await waitReady();
  const id = await userIds();
  const owner = id["owner@abode.dev"];
  const tenant = id["tenant@abode.dev"];

  console.log("— tenant —");
  await check(tenant, "/home", ["dues", "rent"]);
  await check(tenant, "/requests", ["faucet"]);
  await check(tenant, "/dues", ["rent"]);
  await check(tenant, "/messages", ["olivia"]);
  await check(tenant, "/notifications", ["notifications"]);

  console.log("— owner —");
  await check(owner, "/dashboard", ["revenue", "occupied"]);
  await check(owner, "/notifications", ["notifications"]);
  await check(owner, "/fix-it", ["faucet"]);
  await check(owner, "/messages", ["tina"]);
  await check(owner, "/invites", ["invite codes"]);

  console.log("— handyman —");
  const handyman = id["handyman@abode.dev"];
  await check(handyman, "/jobs", ["faucet"]);
  await check(handyman, "/map", ["maple"]);
  const taskId = await firstTaskId(handyman);
  if (taskId) await check(handyman, `/jobs/${taskId}`, ["manager"]);

  console.log(failures === 0 ? "\n✅ SMOKE PASSED" : `\n❌ SMOKE: ${failures} failure(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("smoke error:", e.message);
  process.exit(1);
});
