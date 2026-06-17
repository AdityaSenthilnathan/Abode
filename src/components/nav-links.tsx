"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "./app-shell";

/**
 * Header nav with the current tab highlighted, so users always know where they
 * are. A tab is active on its own route and any nested route (e.g. /requests is
 * active on /requests/[id] and /requests/new). Shared by all three role shells.
 */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 text-sm">
      {items.map((n) => {
        const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-full bg-black/10 px-3 py-1.5 font-medium dark:bg-white/15"
                : "rounded-full px-3 py-1.5 opacity-70 hover:opacity-100"
            }
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
