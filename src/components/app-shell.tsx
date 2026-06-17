import Link from "next/link";
import type { ReactNode } from "react";
import type { SessionUser } from "@/server/auth/session";
import { NavLinks } from "./nav-links";
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
          <NavLinks items={nav} />
          <div className="ml-auto flex items-center gap-3 text-sm">
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
