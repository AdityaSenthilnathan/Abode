"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

/** Polls the unread count every 15s and links to the notifications page. */
export function NotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch("/api/notifications/unread");
        if (r.ok) {
          const j = (await r.json()) as { count?: number };
          if (alive) setCount(j.count ?? 0);
        }
      } catch {
        /* ignore */
      }
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <Link href="/notifications" className="relative opacity-70 hover:opacity-100" aria-label="Notifications">
      <span aria-hidden>🔔</span>
      {count > 0 && (
        <span className="absolute -right-2 -top-1 min-w-[1rem] rounded-full bg-red-600 px-1 text-center text-[10px] font-semibold leading-4 text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
