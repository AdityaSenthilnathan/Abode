"use client";
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * A section whose body can be collapsed. Header (title + optional count + action)
 * is always shown; clicking the title toggles the body. Defaults to open.
 */
export function CollapsibleSection({
  title,
  count,
  action,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="group flex items-center gap-2 text-base font-semibold tracking-tight text-foreground"
        >
          <ChevronDown
            className={`h-4 w-4 text-muted transition-transform group-hover:text-foreground ${
              open ? "" : "-rotate-90"
            }`}
          />
          {title}
          {typeof count === "number" && (
            <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-xs font-medium text-muted">
              {count}
            </span>
          )}
        </button>
        {action}
      </div>
      {open && children}
    </section>
  );
}
