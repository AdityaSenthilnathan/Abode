import "server-only";
import { Client } from "pg";
import { config } from "@/server/config";
import { EVENT_CHANNEL, type AbodeEvent } from "./emit";

/**
 * The single in-process Postgres LISTEN hub. One dedicated `pg.Client` (NOT from
 * the pool — a pooled connection can't hold a session-level LISTEN; the RLS code
 * keeps everything transaction-local precisely so the pool/RDS-Proxy can
 * multiplex) listens on EVENT_CHANNEL and fans each NOTIFY out to every
 * subscribed SSE connection in this process.
 *
 * Lifecycle is tied to active subscribers: the listener connects lazily on the
 * first SSE client and closes shortly after the last one disconnects. So when
 * nobody is online there are ZERO open connections — exactly what lets Aurora
 * Serverless v2 scale to zero / auto-pause. (Polling defeated this by pinging
 * the DB on a timer forever.)
 *
 * Only works in a long-running process (`npm run dev`, App Runner). On
 * serverless the SSE route can't stay open anyway, so clients fall back to
 * polling — see events-provider.tsx.
 */
type Subscriber = (evt: AbodeEvent) => void;

interface Hub {
  client: Client | null;
  connecting: boolean;
  subscribers: Set<Subscriber>;
  retryMs: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

/** Cached on globalThis so Next.js dev hot-reload reuses the one hub (and never
 *  opens a second listener), mirroring the pool in client.ts. */
const g = globalThis as unknown as { __abodeHub?: Hub };
const hub: Hub = (g.__abodeHub ??= {
  client: null,
  connecting: false,
  subscribers: new Set(),
  retryMs: 1000,
  idleTimer: null,
});

const IDLE_CLOSE_MS = 30_000;
const MAX_RETRY_MS = 30_000;

function fanOut(payload: string | undefined) {
  if (!payload) return;
  let evt: AbodeEvent;
  try {
    evt = JSON.parse(payload) as AbodeEvent;
  } catch {
    return;
  }
  for (const fn of hub.subscribers) {
    try {
      fn(evt);
    } catch {
      /* one bad subscriber must not break the rest */
    }
  }
}

async function connect() {
  if (hub.client || hub.connecting) return;
  hub.connecting = true;
  const client = new Client({
    connectionString: config.db.url,
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
  });
  client.on("notification", (msg) => {
    if (msg.channel === EVENT_CHANNEL) fanOut(msg.payload);
  });
  // `error`/`end` both mean the socket is gone (dropped, or Aurora auto-paused
  // it). Drop our handle and reconnect only if anyone is still listening.
  const onGone = () => {
    if (hub.client === client) hub.client = null;
    hub.connecting = false;
    if (hub.subscribers.size > 0) scheduleReconnect();
  };
  client.on("error", onGone);
  client.on("end", onGone);
  try {
    await client.connect();
    await client.query(`LISTEN ${EVENT_CHANNEL}`);
    hub.client = client;
    hub.connecting = false;
    hub.retryMs = 1000; // reset backoff on a clean connect
  } catch {
    hub.connecting = false;
    if (hub.subscribers.size > 0) scheduleReconnect();
  }
}

function scheduleReconnect() {
  const delay = hub.retryMs;
  hub.retryMs = Math.min(hub.retryMs * 2, MAX_RETRY_MS);
  setTimeout(() => {
    if (hub.subscribers.size > 0) void connect();
  }, delay);
}

async function closeIfIdle() {
  hub.idleTimer = null;
  if (hub.subscribers.size > 0) return;
  const client = hub.client;
  hub.client = null;
  if (client) {
    try {
      await client.end();
    } catch {
      /* already gone */
    }
  }
}

/**
 * Subscribe to realtime events for the lifetime of one SSE connection. Connects
 * the listener if it isn't up yet; returns an unsubscribe that closes the
 * listener (after a short grace) once the last client leaves.
 */
export function subscribe(fn: Subscriber): () => void {
  if (hub.idleTimer) {
    clearTimeout(hub.idleTimer);
    hub.idleTimer = null;
  }
  hub.subscribers.add(fn);
  void connect();
  return () => {
    hub.subscribers.delete(fn);
    if (hub.subscribers.size === 0 && !hub.idleTimer) {
      hub.idleTimer = setTimeout(() => void closeIfIdle(), IDLE_CLOSE_MS);
    }
  };
}
