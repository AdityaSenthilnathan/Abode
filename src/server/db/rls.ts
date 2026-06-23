import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { pool, schema } from "@/server/db/client";

/**
 * The Drizzle handle handed to a unit of work. Both `withUser` and `asAdmin`
 * run on a connection they check out themselves (rather than `db.transaction`),
 * so the handle is a plain `NodePgDatabase` bound to that connection — it
 * exposes the same query builder (`select/insert/update/delete/execute`) the
 * services use.
 */
export type DbTx = NodePgDatabase<typeof schema>;

/** Same column-casing config as the shared pool in client.ts. */
const DRIZZLE_OPTS = { schema, casing: "snake_case" } as const;

/** userId is always a server-issued `users.id` (uuid). Validate before we inline
 * it into the batched setup statement below, so a malformed value can never
 * reach the SQL text. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Run a unit of work as a specific application user, with Postgres Row-Level
 * Security enforced.
 *
 * Two things happen, both TRANSACTION-LOCAL so they reset at COMMIT/ROLLBACK and
 * never pin a pooled/proxied connection:
 *   1. `app.current_user_id` is set — RLS policies read it via
 *      current_setting('app.current_user_id').
 *   2. the session role is switched to the low-privilege `abode_app` role, so
 *      RLS policies actually apply (the DB master/owner bypasses RLS).
 *
 * Performance: opening the transaction and applying both settings is sent as a
 * SINGLE simple-protocol round-trip (`BEGIN; set_config; SET LOCAL ROLE`),
 * instead of three separate awaited round-trips. Against the dev Aurora cluster
 * (~27ms RTT, us-west-1) that cuts ~70ms off every tenant-facing read — which
 * is most of the per-navigation cost. The simple protocol can't bind params, so
 * the (validated) uuid is inlined; everything inside `fn` still uses bound
 * params as normal.
 *
 * Every tenant-facing read/write MUST go through this. Admin/system work that
 * legitimately needs to bypass RLS uses `asAdmin()` instead.
 */
export async function withUser<T>(userId: string, fn: (tx: DbTx) => Promise<T>): Promise<T> {
  if (!UUID_RE.test(userId)) throw new Error("withUser: userId must be a uuid");
  const client = await pool.connect();
  try {
    await client.query(
      `begin; select set_config('app.current_user_id', '${userId}', true); set local role abode_app`,
    );
    const result = await fn(drizzle(client, DRIZZLE_OPTS));
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Run a unit of work as the connecting (master) role, which bypasses RLS.
 * Use ONLY for trusted system operations: onboarding, Stripe webhooks,
 * notification fan-out, seeds, migrations.
 */
export async function asAdmin<T>(fn: (tx: DbTx) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await fn(drizzle(client, DRIZZLE_OPTS));
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
