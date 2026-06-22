"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/** Universal light/dark slider. Persists to localStorage; defaults to system. */
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = document.documentElement.dataset.theme;
    const isDark = stored
      ? stored === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    const theme = next ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("theme", theme);
    } catch {
      /* ignore */
    }
  }

  // Avoid a hydration mismatch: keep the footprint identical before we know the theme.
  if (dark === null) {
    return <span className="h-9 w-16 shrink-0 rounded-full border border-line bg-surface-2" aria-hidden />;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={dark}
      aria-label="Toggle dark mode"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative inline-flex h-9 w-16 shrink-0 items-center rounded-full border border-line bg-surface-2 transition-colors"
    >
      <Sun className="pointer-events-none absolute left-2 h-4 w-4 text-muted" />
      <Moon className="pointer-events-none absolute right-2 h-4 w-4 text-muted" />
      <span
        className={`absolute left-1 flex h-7 w-7 items-center justify-center rounded-full bg-surface shadow-sm transition-transform duration-200 ${
          dark ? "translate-x-7" : "translate-x-0"
        }`}
      >
        {dark ? <Moon className="h-4 w-4 text-brand" /> : <Sun className="h-4 w-4 text-amber-500" />}
      </span>
    </button>
  );
}
