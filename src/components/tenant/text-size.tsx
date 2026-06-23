"use client";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";

/**
 * Text-size preference — Regular / Medium / Large. Persists to localStorage and
 * sets `data-text-size` on <html>; globals.css scales the root font-size, so the
 * whole UI grows proportionally (helpful for older tenants). The pre-paint script
 * in app/layout.tsx applies the saved choice before first render to avoid a flash.
 */
const SIZES = [
  { key: "regular", label: "Regular", sample: "text-base" },
  { key: "medium", label: "Medium", sample: "text-lg" },
  { key: "large", label: "Large", sample: "text-2xl" },
] as const;
type Size = (typeof SIZES)[number]["key"];

export function TextSizeControl() {
  // Default to "regular" for a stable first render; the effect corrects it to the
  // saved value once mounted (the actual text size is already right pre-paint).
  const [size, setSize] = useState<Size>("regular");

  useEffect(() => {
    const stored = document.documentElement.dataset.textSize;
    if (stored === "medium" || stored === "large") setSize(stored);
  }, []);

  function choose(next: Size) {
    setSize(next);
    if (next === "regular") delete document.documentElement.dataset.textSize;
    else document.documentElement.dataset.textSize = next;
    try {
      localStorage.setItem("textSize", next);
    } catch {
      /* ignore */
    }
  }

  return (
    <div role="radiogroup" aria-label="Text size" className="grid grid-cols-3 gap-2 sm:gap-3">
      {SIZES.map((s) => {
        const active = size === s.key;
        return (
          <button
            key={s.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(s.key)}
            className={`relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-3 py-4 transition ${
              active
                ? "border-brand bg-brand/10 text-brand shadow-sm"
                : "border-line text-muted hover:border-brand/40 hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            {active && (
              <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-brand-foreground">
                <Check className="h-3 w-3" />
              </span>
            )}
            <span className={`font-semibold leading-none ${s.sample}`}>Aa</span>
            <span className="text-xs font-medium">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
