"use client";
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** A self-contained collapsible panel with an icon, title, subtitle, and a
 *  trailing slot (e.g. a count badge). Used to tame long owner pages.
 *  `icon` is a rendered node (e.g. `<Plus className="h-[18px] w-[18px]" />`) —
 *  a lucide component type can't cross the server→client boundary as a prop. */
export function Collapsible({
  title,
  subtitle,
  badge,
  defaultOpen = false,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm shadow-black/[0.03] dark:shadow-black/20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-surface-2"
      >
        {icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-semibold tracking-tight">{title}</div>
          {subtitle && <div className="truncate text-sm text-muted">{subtitle}</div>}
        </div>
        {badge}
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 text-muted transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="border-t border-line p-4">{children}</div>}
    </div>
  );
}
