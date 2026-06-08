/**
 * RLS isolation tests: proves each user sees only their own scope, that
 * cross-tenant access is denied, and that an unset context is default-deny.
 *   DATABASE_URL=... PGSSL=disable npx tsx db/verify-rls.ts
 */
import "dotenv/config";
import { Pool } from "pg";

let failures = 0;
function assert(cond: boolean, label: string, detail: string) {
  if (!cond) failures++;
  console.log(`  ${cond ? "✓" : "✗"} ${label} — ${detail}`);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const pool = new Pool({
    connectionString: url,
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
  });

  const users = (await pool.query("select id, email, role from users order by email")).rows;
  const byEmail = (e: string) => users.find((u) => u.email === e);
  const tina = byEmail("tenant@abode.dev");
  const tom = byEmail("tenant2@abode.dev");
  const owner = byEmail("owner@abode.dev");
  if (!tina || !tom || !owner) throw new Error("seed users missing — run db:seed");

  async function scope(id: string | null) {
    const c = await pool.connect();
    try {
      await c.query("begin");
      if (id) await c.query("select set_config('app.current_user_id', $1, true)", [id]);
      await c.query("set local role abode_app");
      const units = (await c.query("select unit_number from units order by unit_number")).rows.map((r) => r.unit_number);
      const invoices = (await c.query("select count(*)::int n from invoices")).rows[0].n as number;
      await c.query("commit");
      return { units, invoices };
    } finally {
      c.release();
    }
  }

  console.log("RLS isolation:");
  const a = await scope(tina.id);
  assert(a.units.join() === "101" && a.invoices === 2, "tenant Tina", `units=[${a.units}] invoices=${a.invoices} (expect [101], 2)`);

  const b = await scope(tom.id);
  assert(b.units.join() === "102" && b.invoices === 1, "tenant Tom", `units=[${b.units}] invoices=${b.invoices} (expect [102], 1)`);
  assert(!b.units.includes("101"), "cross-tenant denied", "Tom cannot see Tina's unit 101");

  const o = await scope(owner.id);
  assert(o.units.length === 3 && o.invoices === 3, "owner Olivia", `units=[${o.units}] invoices=${o.invoices} (expect 3 units, 3 invoices)`);

  const d = await scope(null);
  assert(d.units.length === 0 && d.invoices === 0, "default-deny", `units=${d.units.length} invoices=${d.invoices} (expect 0, 0 with no context)`);

  await pool.end();
  console.log(failures === 0 ? "\n✅ RLS TESTS PASSED" : `\n❌ RLS TESTS: ${failures} failure(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("rls test error:", e.message);
  process.exit(1);
});
