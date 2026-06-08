import Link from "next/link";
import type { ReactNode } from "react";
import type { SessionUser } from "@/server/auth/session";
import { NotificationBell } from "@/components/notification-bell";

export interface NavItem {
  href: string;
  label: string;
}

/** Shared chrome for the three role experiences: header, nav, sign-out. */
export function AppShell({
  user,
  nav,
  children,
}: {
  user: SessionUser;
  nav: NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-black/10 dark:border-white/15">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href="/" className="font-semibold tracking-tight">
            Abode
          </Link>
          <nav className="flex gap-4 text-sm">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="opacity-70 hover:opacity-100">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <NotificationBell />
            <span className="opacity-60">
              {user.fullName ?? user.email} · <span className="capitalize">{user.role}</span>
            </span>
            <Link href="/logout" className="opacity-70 hover:opacity-100">
              Sign out
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
