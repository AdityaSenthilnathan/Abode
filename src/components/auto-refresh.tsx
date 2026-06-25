"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Drop into a Server Component page to keep it live: re-runs the server render
 * (and its data fetch) every `intervalMs` via router.refresh(), so jobs and
 * project timelines update without a manual reload.
 *
 * Pauses while the tab is hidden and refreshes immediately on re-focus, so idle
 * tabs don't keep the scale-to-zero Aurora cluster awake. AppSync Events is the
 * documented production upgrade over this polling.
 */
export function AutoRefresh({ intervalMs = 10000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer == null) {
        timer = setInterval(() => {
          if (document.visibilityState === "visible") router.refresh();
        }, intervalMs);
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
  }, [router, intervalMs]);

  return null;
}
