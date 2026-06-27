"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAbodeEvents } from "./realtime/events-provider";

/**
 * Drop into a Server Component page to keep it live: re-runs the server render
 * (and its data fetch) so jobs and project timelines update without a manual
 * reload.
 *
 * Primary trigger is now realtime: any notification/message/job event calls
 * router.refresh() immediately. The interval is a slow safety net (stretched to
 * 60s while the SSE stream is live, original `intervalMs` otherwise). Pauses
 * while the tab is hidden and refreshes on re-focus, so idle tabs don't keep the
 * scale-to-zero Aurora cluster awake.
 */
export function AutoRefresh({ intervalMs = 10000 }: { intervalMs?: number }) {
  const router = useRouter();
  const events = useAbodeEvents();
  const live = events?.live ?? false;
  const effectiveInterval = live ? Math.max(intervalMs, 60000) : intervalMs;

  // Realtime trigger: refresh the server render on any event (visible tab only).
  useEffect(() => {
    if (!events) return;
    const onAny = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const offN = events.on("notification", onAny);
    const offM = events.on("message", onAny);
    const offJ = events.on("job", onAny);
    return () => {
      offN();
      offM();
      offJ();
    };
  }, [events, router]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer == null) {
        timer = setInterval(() => {
          if (document.visibilityState === "visible") router.refresh();
        }, effectiveInterval);
      }
    };
    const stop = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, effectiveInterval]);

  return null;
}
