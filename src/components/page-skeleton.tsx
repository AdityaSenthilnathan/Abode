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
        <div className="h-7 w-48 rounded-md bg-black/10 dark:bg-white/15" />
        <div className="h-4 w-72 rounded bg-black/10 dark:bg-white/10" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/15">
            <div className="h-5 w-2/3 rounded bg-black/10 dark:bg-white/15" />
            <div className="h-3 w-1/3 rounded bg-black/10 dark:bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}
