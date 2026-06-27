import { getCurrentUser } from "@/server/auth/session";
import { subscribe } from "@/server/realtime/hub";
import type { AbodeEvent } from "@/server/realtime/emit";

// Long-lived SSE stream → needs the Node runtime (uses pg via the hub) and must
// never be cached or statically rendered.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// On a serverless host (Vercel) the stream can only live as long as the
// function does; ask for the longest window the plan allows so the browser
// reconnects rarely. On a long-running host (App Runner) this is a no-op.
export const maxDuration = 60;

/**
 * Server-Sent Events stream of realtime signals for the authenticated user.
 *
 * Per-user fan-out is enforced HERE, server-side: we resolve the user from the
 * same auth cookies every other route uses, and only forward an event whose
 * `recipients` set includes them. The client never asks to "subscribe to user
 * X" — the server decides. `recipients` is stripped before sending so a client
 * can't even learn who else was notified. The actual data is still fetched
 * through the existing RLS-guarded endpoints (defense in depth).
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  const me = user.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;
      let unsubscribe: () => void = () => {};
      const timers: { heartbeat?: ReturnType<typeof setInterval> } = {};

      const cleanup = () => {
        if (!open) return;
        open = false;
        if (timers.heartbeat) clearInterval(timers.heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const send = (chunk: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      // Flush a comment immediately so the browser marks the stream open.
      send(": connected\n\n");

      unsubscribe = subscribe((evt: AbodeEvent) => {
        if (!evt.recipients.includes(me)) return;
        // Strip the recipient list — a client must never learn who else got it.
        const data: Record<string, unknown> = { ...evt };
        delete data.recipients;
        send(`event: ${evt.topic}\ndata: ${JSON.stringify(data)}\n\n`);
      });

      // Heartbeat comment beats proxy / App Runner idle timeouts (~60–120s).
      timers.heartbeat = setInterval(() => send(": ping\n\n"), 25_000);

      // Tab close / navigation aborts the request → unsubscribe + close.
      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
