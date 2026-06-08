import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";

/** The Drizzle transaction handle type, derived from the client. */
export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Run a unit of work as a specific application user, with Postgres Row-Level
 * Security enforced.
 *
 * Two things happen inside the transaction, both TRANSACTION-LOCAL so they
 * reset at COMMIT and never pin a pooled/proxied connection:
 *   1. `app.current_user_id` is set — RLS policies read it via
 *      current_setting('app.current_user_id').
 *   2. the session role is switched to the low-privilege `abode_app` role, so
 *      RLS policies actually apply (the DB master/owner bypasses RLS).
 *
 * Every tenant-facing read/write MUST go through this. Admin/system work that
 * legitimately needs to bypass RLS uses `asAdmin()` instead.
 */
export async function withUser<T>(userId: string, fn: (tx: DbTx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
    await tx.execute(sql`set local role abode_app`);
    return fn(tx);
  });
}

/**
 * Run a unit of work as the connecting (master) role, which bypasses RLS.
 * Use ONLY for trusted system operations: onboarding, Stripe webhooks,
 * notification fan-out, seeds, migrations.
 */
export async function asAdmin<T>(fn: (tx: DbTx) => Promise<T>): Promise<T> {
  return db.transaction((tx) => fn(tx));
}
