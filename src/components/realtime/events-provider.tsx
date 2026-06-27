"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type EventTopic = "notification" | "message" | "job";
type Handler = (data: Record<string, unknown> | null) => void;

interface EventsApi {
  /** Subscribe a handler to a topic; returns an unsubscribe. */
  on: (topic: EventTopic, handler: Handler) => () => void;
  /** True while the SSE stream is connected. When false, consumers should poll. */
  live: boolean;
}

const EventsCtx = createContext<EventsApi | null>(null);

/**
 * Owns the single `EventSource` to /api/events/stream and fans realtime signals
 * out to subscribed components, replacing their polling timers. Mounted once in
 * AppShell so it covers every authenticated page.
 *
 * Graceful degradation: if the browser has no EventSource, or the stream can't
 * stay open (e.g. on Vercel serverless where there's no long-running listener),
 * `live` stays false and each consumer keeps its existing fallback polling. The
 * feature is purely additive — nothing breaks without it.
 */
export function EventsProvider({ children }: { children: ReactNode }) {
  const handlers = useRef<Record<EventTopic, Set<Handler>>>({
    notification: new Set(),
    message: new Set(),
    job: new Set(),
  });
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("EventSource" in window)) return;
    const es = new EventSource("/api/events/stream"); // sends auth cookies automatically

    const dispatch = (topic: EventTopic) => (e: MessageEvent) => {
      setLive(true);
      let data: Record<string, unknown> | null = null;
      try {
        data = JSON.parse(e.data) as Record<string, unknown>;
      } catch {
        /* keep null */
      }
      handlers.current[topic].forEach((h) => {
        try {
          h(data);
        } catch {
          /* ignore one bad handler */
        }
      });
    };

    const onNotification = dispatch("notification");
    const onMessage = dispatch("message");
    const onJob = dispatch("job");
    es.addEventListener("notification", onNotification);
    es.addEventListener("message", onMessage);
    es.addEventListener("job", onJob);
    es.onopen = () => setLive(true);
    // EventSource auto-reconnects on transient drops; while it can't, `live`
    // goes false so consumers resume polling.
    es.onerror = () => setLive(false);

    return () => {
      es.removeEventListener("notification", onNotification);
      es.removeEventListener("message", onMessage);
      es.removeEventListener("job", onJob);
      es.close();
    };
  }, []);

  const on = useCallback((topic: EventTopic, handler: Handler) => {
    const set = handlers.current[topic];
    set.add(handler);
    return () => {
      set.delete(handler);
    };
  }, []);

  return <EventsCtx.Provider value={{ on, live }}>{children}</EventsCtx.Provider>;
}

/** Returns the realtime API, or null when no provider is mounted (then poll). */
export function useAbodeEvents(): EventsApi | null {
  return useContext(EventsCtx);
}
