import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Abode UI kit — shared primitives every role experience composes from.
 * All server-component friendly (no client hooks). Built on the design tokens
 * in globals.css (surface / line / muted / brand …).
 */

/* --------------------------------------------------------------------- Card */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface shadow-sm shadow-black/[0.03] dark:shadow-black/20",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------- Badge */
const TONES = {
  neutral: "bg-foreground/[0.06] text-muted",
  brand: "bg-brand/10 text-brand",
  success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  danger: "bg-red-500/15 text-red-600 dark:text-red-400",
  info: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Buttons */
export const button = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:brightness-110 active:scale-[.99] disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium transition hover:bg-surface-2 disabled:opacity-60",
  ghost:
    "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted transition hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-60",
} as const;

/* ----------------------------------------------------------- Section header */
export function SectionHeader({
  title,
  icon: Icon,
  action,
}: {
  title: string;
  icon?: ComponentType<{ className?: string }>;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
        {Icon && <Icon className="h-4 w-4 text-muted" />}
        {title}
      </h2>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------- Empty state */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      {Icon && (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-foreground/[0.05] text-muted">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div>
        <p className="font-medium">{title}</p>
        {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      </div>
      {action}
    </Card>
  );
}

/* ----------------------------------------------------- status → tone helpers */
export function invoiceTone(status: string): Tone {
  return status === "paid"
    ? "success"
    : status === "late"
      ? "danger"
      : status === "deferred"
        ? "neutral"
        : "warning";
}

export function requestTone(status: string): Tone {
  return status === "done" ? "success" : status === "working" ? "warning" : "info";
}
