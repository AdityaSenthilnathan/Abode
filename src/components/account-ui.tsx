import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { Card, button } from "@/components/ui";

/**
 * Shared building blocks for the role account pages (tenant + handyman), so the
 * two stay visually in lockstep. All server-component friendly (no client hooks).
 */

/** First-letter initials from a name (falling back to the email), for avatar chips. */
export function initials(name: string | null, email: string): string {
  const base = (name ?? email).trim();
  const parts = base.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || base[0]?.toUpperCase() || "?";
}

/** Gradient identity header shown at the top of every account page. */
export function AccountProfileHeader({
  name,
  email,
  fallback,
  badge,
}: {
  name: string | null;
  email: string;
  fallback: string;
  badge: ReactNode;
}) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-accent text-lg font-semibold text-brand-foreground shadow-sm">
        {initials(name, email)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-lg font-semibold">{name ?? fallback}</div>
        <div className="truncate text-sm text-muted">{email}</div>
      </div>
      {badge}
    </Card>
  );
}

/** A labelled fact row inside an info card. */
export function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-3.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted">{label}</div>
        <div className="mt-0.5 font-medium break-words">{children}</div>
      </div>
    </div>
  );
}

/** A person you can reach (manager or maintenance) with a message shortcut. */
export function ContactRow({
  icon: Icon,
  role,
  name,
  email,
  toUserId,
}: {
  icon: ComponentType<{ className?: string }>;
  role: string;
  name: string | null;
  email: string;
  /** When set, "Message" opens the 1:1 chat with this user directly (creating
   *  the conversation if needed); otherwise it falls back to the inbox. */
  toUserId?: string | null;
}) {
  const href = toUserId ? `/messages?to=${toUserId}` : "/messages";
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
        {initials(name, email)}
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface bg-surface-2 text-muted">
          <Icon className="h-3 w-3" />
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{name ?? email}</div>
        <div className="truncate text-xs text-muted">
          {role} · {email}
        </div>
      </div>
      <Link href={href} className={`${button.secondary} shrink-0`}>
        Message
      </Link>
    </div>
  );
}
