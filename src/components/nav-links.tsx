"use client";
import { useCallback, useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Briefcase,
  Building2,
  CreditCard,
  House,
  LayoutDashboard,
  Map,
  MessageSquare,
  Settings,
  Ticket,
  Wallet,
  Wrench,
} from "lucide-react";
import type { NavItem } from "./app-shell";
import { useAbodeEvents } from "./realtime/events-provider";

/** Icon per nav route, shared across all role shells. */
const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  "/home": House,
  "/requests": Wrench,
  "/dues": CreditCard,
  "/notifications": Bell,
  "/messages": MessageSquare,
  "/settings": Settings,
  "/dashboard": LayoutDashboard,
  "/properties": Building2,
  "/fix-it": Wrench,
  "/invites": Ticket,
  "/jobs": Briefcase,
  "/map": Map,
  "/earnings": Wallet,
};

/**
 * Header nav with the current tab highlighted, so users always know where they
 * are. A tab is active on its own route and any nested route (e.g. /requests is
 * active on /requests/[id] and /requests/new). Shared by all three role shells.
 */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const hasMessages = items.some((n) => n.href === "/messages");
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const events = useAbodeEvents();
  const live = events?.live ?? false;

  // Global unread-messages count, so new messages surface on any screen — not
  // just inside an open thread. Refetches instantly on a realtime "message"
  // event; the interval is a slow safety net (60s) when SSE is live, or the
  // original 10s polling when it isn't. Also re-polls on navigation (e.g. right
  // after you open a thread, which clears its unread).
  const poll = useCallback(async () => {
    try {
      const r = await fetch("/api/messages/unread");
      if (r.ok) {
        const j = (await r.json()) as { count?: number };
        setUnreadMsgs(j.count ?? 0);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!hasMessages) return;
    return events?.on("message", poll);
  }, [hasMessages, events, poll]);

  useEffect(() => {
    if (!hasMessages) return;
    poll();
    const id = setInterval(poll, live ? 60000 : 10000);
    return () => clearInterval(id);
  }, [hasMessages, pathname, live, poll]);

  return (
    <nav className="flex items-center gap-1 text-sm">
      {items.map((n) => {
        const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
        const Icon = ICONS[n.href];
        const showBadge = n.href === "/messages" && unreadMsgs > 0;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-medium transition ${
              active
                ? "bg-brand/10 text-brand"
                : "text-muted hover:bg-foreground/[0.06] hover:text-foreground"
            }`}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" />}
            <span className="hidden whitespace-nowrap sm:inline">{n.label}</span>
            {showBadge && (
              <span
                aria-label={`${unreadMsgs} unread`}
                className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white"
              >
                {unreadMsgs > 9 ? "9+" : unreadMsgs}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
