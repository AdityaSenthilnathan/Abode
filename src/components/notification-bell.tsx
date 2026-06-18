"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";

/** Polls the unread count every 15s and links to the notifications page. */
export function NotificationBell() {
  const [count, setCount] = useState(0);
  const pathname = usePathname();
  const active = pathname === "/notifications";

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
  }, [pathname]);

  return (
    <Link
      href="/notifications"
      aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
      className={`relative flex h-9 w-9 items-center justify-center rounded-full border border-line transition hover:bg-surface-2 ${
        active ? "bg-surface-2 text-foreground" : "text-muted"
      }`}
    >
      <Bell className="h-[18px] w-[18px]" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-background">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
