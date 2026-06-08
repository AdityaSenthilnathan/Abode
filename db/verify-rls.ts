/**
 * RLS smoke test: proves each user sees only their own scope through the
 * `withUser` pattern (set_config + SET LOCAL ROLE abode_app). Run after seed:
 *   DATABASE_URL=... PGSSL=disable npx tsx db/verify-rls.ts
 */
import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const pool = new Pool({
    connectionString: url,
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
  });

  const users = (await pool.query("select id, email, role from users order by email")).rows;
  console.log("seeded users:", users.map((u) => `${u.email}(${u.role})`).join(", "));
  const tina = users.find((u) => u.email === "tenant@abode.dev");
  const owner = users.find((u) => u.email === "owner@abode.dev");
  if (!tina || !owner) throw new Error("expected seed users missing");

  async function asUser(id: string, label: string) {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('app.current_user_id', $1, true)", [id]);
      await c.query("set local role abode_app");
      const units = (await c.query("select unit_number from units order by unit_number")).rows.map((r) => r.unit_number);
      const invoices = (await c.query("select count(*)::int n from invoices")).rows[0].n;
      const notifs = (await c.query("select count(*)::int n from notifications")).rows[0].n;
      await c.query("commit");
      console.log(`  [${label}] units=[${units.join(",") || "-"}] invoices=${invoices} notifications=${notifs}`);
    } finally {
      c.release();
    }
  }

  console.log("\nRLS isolation (each user should see ONLY their own scope):");
  await asUser(tina.id, "tenant Tina ");
  await asUser(owner.id, "owner Olivia");
  console.log("\nExpected → Tina: units=[101] invoices=2 notifications=1 ; Olivia: units=[101,102,103] invoices=3 notifications=2");

  await pool.end();
}

main().catch((e) => {
  console.error("verify failed:", e.message);
  process.exit(1);
});
