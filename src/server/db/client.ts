import "server-only";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@db/schema";
import { config } from "@/server/config";

/**
 * A single pooled connection to Postgres (Aurora in dev/prod, or a local PG).
 * In prod this points at the RDS Proxy endpoint; the transaction-local RLS
 * pattern in rls.ts is what keeps the proxy's connection multiplexing intact.
 *
 * Cached on globalThis so Next.js hot-reload in dev doesn't open a new pool
 * on every change.
 */
const globalForDb = globalThis as unknown as { __abodePool?: Pool };

export const pool =
  globalForDb.__abodePool ??
  new Pool({
    connectionString: config.db.url,
    max: 10,
    // Aurora requires TLS. `PGSSL=disable` opts out for a plain local Postgres.
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") globalForDb.__abodePool = pool;

export const db = drizzle(pool, { schema, casing: "snake_case" });
export { schema };
