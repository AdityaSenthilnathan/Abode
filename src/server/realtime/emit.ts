import "server-only";
import { sql } from "drizzle-orm";
import type { DbTx } from "@/server/db/rls";

/**
 * Postgres LISTEN/NOTIFY channel that carries every realtime domain event.
 * One channel for the whole app; per-user fan-out happens in the SSE route,
 * which only forwards an event to a client whose id is in `recipients`.
 */
export const EVENT_CHANNEL = "abode_events";

/**
 * A realtime signal — NOT the data itself. It carries only ids/counts so the
 * client knows WHAT changed and can refetch the existing RLS-guarded endpoints.
 * Kept tiny on purpose: `pg_notify`'s payload is capped at 8000 bytes, and
 * shipping no row content means a mis-routed signal can never leak private data.
 */
export type AbodeEvent =
  | { topic: "notification"; recipients: string[]; entityType?: string; entityId?: string }
  | { topic: "message"; recipients: string[]; conversationId: string; taskId?: string | null }
  | { topic: "job"; recipients: string[]; conversationId?: string | null; taskId: string };

/**
 * Emit a realtime event in the SAME transaction as the mutation. A `NOTIFY`
 * issued inside a transaction is only delivered to listeners on COMMIT, so the
 * signal is atomic with the write — a rollback emits nothing. The payload is
 * bound as a parameter (no injection surface), unlike the inlined-uuid trick in
 * rls.ts which only exists because of its simple-protocol batch.
 */
export async function emitEvent(tx: DbTx, evt: AbodeEvent): Promise<void> {
  await tx.execute(sql`select pg_notify(${EVENT_CHANNEL}, ${JSON.stringify(evt)})`);
}
