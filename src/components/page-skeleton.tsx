/**
 * Generic content-area skeleton shown via App Router `loading.tsx` while a
 * page's server data is still loading. The shared AppShell (header + nav)
 * stays mounted across navigations, so this only fills the <main> region —
 * giving tab-to-tab navigation an instant response instead of blocking on
 * the slowest query before anything renders.
 */
export function PageSkeleton() {
  return (
    <div className="space-y-8 animate-pulse" aria-hidden>
      <div className="space-y-2">
        <div className="h-8 w-52 rounded-lg bg-foreground/10" />
        <div className="h-4 w-72 rounded bg-foreground/[0.06]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-line bg-surface" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-line bg-surface p-4">
            <div className="h-5 w-2/3 rounded bg-foreground/10" />
            <div className="h-3 w-1/3 rounded bg-foreground/[0.06]" />
          </div>
        ))}
      </div>
    </div>
  );
}
