"use client";
import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Briefcase,
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

/** Icon per nav route, shared across all role shells. */
const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  "/home": House,
  "/requests": Wrench,
  "/dues": CreditCard,
  "/notifications": Bell,
  "/messages": MessageSquare,
  "/settings": Settings,
  "/dashboard": LayoutDashboard,
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
  return (
    <nav className="flex items-center gap-1 text-sm">
      {items.map((n) => {
        const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
        const Icon = ICONS[n.href];
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
            {Icon && <Icon className="h-4 w-4" />}
            <span className="hidden sm:inline">{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
