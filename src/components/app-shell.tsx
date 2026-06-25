import Link from "next/link";
import type { ReactNode } from "react";
import { House, LogOut } from "lucide-react";
import type { SessionUser } from "@/server/auth/session";
import { logoutAction } from "@/actions/auth";
import { NavLinks } from "./nav-links";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";

export interface NavItem {
  href: string;
  label: string;
}

function initials(user: SessionUser): string {
  const base = user.fullName ?? user.email;
  const parts = base.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || base[0]?.toUpperCase() || "?";
}

/** Account identity in the header. Tenants and handymen link to their account page. */
function AccountChip({ user }: { user: SessionUser }) {
  const inner = (
    <>
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
        {initials(user)}
      </span>
      <span className="hidden leading-tight sm:block">
        <span className="block text-xs font-medium">{user.fullName ?? user.email}</span>
        <span className="block text-[11px] capitalize text-muted">{user.role}</span>
      </span>
    </>
  );
  const cls = "flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-1 sm:pr-3";
  // Tenants and handymen each have an account page; the chip is its entry point.
  const accountHref =
    user.role === "tenant" ? "/settings" : user.role === "employee" ? "/account" : null;
  if (accountHref) {
    return (
      <Link href={accountHref} title="Account settings" className={`${cls} transition hover:bg-surface-2`}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}

/** Shared chrome for the three role experiences: header, nav, account, sign-out. */
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
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-sm">
              <House className="h-[18px] w-[18px]" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Abode</span>
          </Link>

          <div className="mx-1 hidden h-6 w-px bg-line sm:block" />
          <NavLinks items={nav} />

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
            <AccountChip user={user} />
            {/* Sign out is a POST (server action), NOT a <Link>. A GET /logout
               link gets prefetched by Next in production, which would silently
               fire the logout and wipe the session on every page load. */}
            <form action={logoutAction} className="flex">
              <button
                type="submit"
                aria-label="Sign out"
                title="Sign out"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted transition hover:bg-surface-2 hover:text-foreground"
              >
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">{children}</main>
    </div>
  );
}
