/**
 * Aurora backdrop — the shared decorative layer behind the landing + auth
 * pages. Three slowly drifting color blobs, a faint blueprint grid that fades
 * out toward the bottom, and a whisper of film grain for texture. Pure markup
 * (no client JS); all motion lives in globals.css and respects
 * prefers-reduced-motion.
 */
export function Backdrop({ grid = true }: { grid?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-background" />
      <div className="aurora-blob aurora-1" />
      <div className="aurora-blob aurora-2" />
      <div className="aurora-blob aurora-3" />
      {grid && <div className="absolute inset-0 bg-grid" />}
      <div className="absolute inset-0 bg-grain opacity-[0.16]" />
    </div>
  );
}

/** Abode wordmark: rounded brand tile + name. Size scales the whole lockup. */
export function Wordmark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const tile =
    size === "lg" ? "h-11 w-11 rounded-2xl" : size === "sm" ? "h-7 w-7 rounded-lg" : "h-9 w-9 rounded-xl";
  const glyph = size === "lg" ? "h-6 w-6" : size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg";
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={`relative flex items-center justify-center ${tile} bg-gradient-to-br from-brand to-accent text-brand-foreground shadow-lg shadow-brand/30`}
      >
        <svg viewBox="0 0 24 24" fill="none" className={glyph} aria-hidden>
          <path
            d="M3 11.2 12 4l9 7.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5.2 9.6V19a1 1 0 0 0 1 1H10v-5a2 2 0 0 1 4 0v5h3.8a1 1 0 0 0 1-1V9.6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className={`font-semibold tracking-tight ${text}`}>Abode</span>
    </span>
  );
}
