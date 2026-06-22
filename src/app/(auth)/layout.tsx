import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Backdrop, Wordmark } from "@/components/marketing/backdrop";

/** Shared chrome for /login and /signup: aurora backdrop + a minimal top bar. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-col">
      <Backdrop />
      <header className="animate-fade-in mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="transition-opacity hover:opacity-80">
          <Wordmark />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16 pt-2">{children}</main>
    </div>
  );
}
