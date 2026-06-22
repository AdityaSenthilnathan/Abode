import { cn } from "@/lib/utils";

/**
 * Page-shaped loading skeletons. Each mirrors the real layout of the page it
 * stands in for (rendered via that route's `loading.tsx`), so the placeholder
 * matches where content will actually land instead of a generic block.
 *
 * Palette: `bg-foreground/10` = solid element, `bg-foreground/[0.06]` = faint
 * secondary text. Cards reuse the real `border-line bg-surface` chrome.
 */

/** A single shimmer block. Pass a faint bg via className to override the default. */
function Bar({ className }: { className?: string }) {
  return <div className={cn("rounded bg-foreground/10", className)} aria-hidden />;
}

function PageHeader({ titleW = "w-40", subW = "w-72" }: { titleW?: string; subW?: string }) {
  return (
    <div className="space-y-2">
      <Bar className={cn("h-8", titleW)} />
      <Bar className={cn("h-4 bg-foreground/[0.06]", subW)} />
    </div>
  );
}

/* --------------------------------------------------------------- jobs list */
export function JobsSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <PageHeader titleW="w-24" subW="w-80" />
      <div className="space-y-3">
        {/* location banner */}
        <Bar className="h-9 w-full rounded-lg bg-foreground/[0.04]" />
        {/* sort bar */}
        <div className="flex items-center gap-2">
          <Bar className="h-4 w-12 bg-foreground/[0.06]" />
          <Bar className="h-[30px] w-28 rounded-lg bg-foreground/[0.06]" />
          <Bar className="h-[30px] w-[30px] rounded-lg bg-foreground/[0.06]" />
        </div>
        {/* cards */}
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <Bar className="h-4 w-56" />
                <Bar className="h-3 w-64 bg-foreground/[0.06]" />
              </div>
              <Bar className="h-5 w-16 rounded-full bg-foreground/[0.06]" />
            </div>
            <div className="mt-2.5 flex items-center gap-1.5">
              <Bar className="h-6 w-16 rounded-full bg-foreground/[0.06]" />
              <Bar className="h-6 w-24 rounded-full bg-foreground/[0.06]" />
              <Bar className="ml-auto h-7 w-16 rounded-lg bg-foreground/[0.06]" />
              <Bar className="h-7 w-16 rounded-lg bg-foreground/[0.06]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- job detail */
export function JobDetailSkeleton() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse space-y-6" aria-hidden>
      <Bar className="h-4 w-24 bg-foreground/[0.06]" />
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Bar className="h-7 w-64" />
          <Bar className="h-4 w-48 bg-foreground/[0.06]" />
        </div>
        <Bar className="h-9 w-44 rounded-lg bg-foreground/[0.06]" />
      </div>
      <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
        {["w-2/3", "w-1/3", "w-1/2", "w-3/4", "w-1/4"].map((w, i) => (
          <Bar key={i} className={cn("h-3.5 bg-foreground/[0.06]", w)} />
        ))}
      </div>
      <Bar className="h-16 w-full rounded-xl bg-foreground/[0.04]" />
    </div>
  );
}

/* --------------------------------------------------------------------- map */
export function MapSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <PageHeader titleW="w-16" subW="w-40" />
      <div className="h-[60vh] rounded-xl border border-line bg-surface-2" />
    </div>
  );
}

/* ---------------------------------------------------------------- messages */
export function MessagesSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <PageHeader titleW="w-40" subW="w-40" />
      <Bar className="h-9 w-56 rounded-xl bg-foreground/[0.06]" />
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <div className="h-10 w-10 shrink-0 rounded-full bg-foreground/10" aria-hidden />
            <div className="flex-1 space-y-2">
              <Bar className="h-4 w-32" />
              <Bar className="h-3 w-48 bg-foreground/[0.06]" />
              <Bar className="h-4 w-44 rounded-full bg-foreground/[0.06]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- earnings */
export function EarningsSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <PageHeader titleW="w-32" subW="w-80" />
      <div className="flex items-center justify-between">
        <Bar className="h-10 w-80 rounded-xl bg-foreground/[0.06]" />
        <Bar className="h-10 w-40 rounded-xl bg-foreground/[0.06]" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="mb-5 flex items-center justify-between">
            <div className="space-y-2">
              <Bar className="h-3 w-32 bg-foreground/[0.06]" />
              <Bar className="h-7 w-28" />
            </div>
            <Bar className="h-9 w-20 rounded-lg bg-foreground/[0.06]" />
          </div>
          <div className="flex items-center gap-6">
            <div className="h-40 w-40 shrink-0 rounded-full border-[15px] border-foreground/[0.06]" />
            <div className="flex-1 space-y-2.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Bar key={i} className="h-4 w-full bg-foreground/[0.06]" />
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="space-y-3 rounded-2xl border border-line bg-surface p-5">
            <Bar className="h-4 w-24" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Bar key={i} className="h-3 w-full bg-foreground/[0.06]" />
            ))}
          </div>
          <div className="space-y-3 rounded-2xl border border-line bg-surface p-5">
            <Bar className="h-4 w-32" />
            <Bar className="h-12 w-full rounded-xl bg-foreground/[0.06]" />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <Bar className="h-4 w-40" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl border border-line bg-surface" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- chat thread */
export function ChatThreadSkeleton() {
  // Mirrors the message bubbles + composer of a conversation thread.
  const bubbles = [
    { mine: false, w: "w-40" },
    { mine: true, w: "w-32" },
    { mine: false, w: "w-52" },
    { mine: true, w: "w-44" },
    { mine: false, w: "w-28" },
  ];
  return (
    <div className="mx-auto flex h-[70vh] max-w-2xl animate-pulse flex-col" aria-hidden>
      <div className="flex items-center gap-3 border-b border-line pb-4">
        <div className="h-9 w-9 rounded-full bg-foreground/10" aria-hidden />
        <Bar className="h-5 w-40" />
      </div>
      <div className="flex flex-1 flex-col gap-3 py-4">
        {bubbles.map((b, i) => (
          <div key={i} className={cn("flex", b.mine ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "h-9 rounded-2xl",
                b.w,
                b.mine ? "bg-brand/20" : "bg-foreground/10",
              )}
            />
          </div>
        ))}
      </div>
      <Bar className="h-11 w-full rounded-xl bg-foreground/[0.06]" />
    </div>
  );
}

/* ----------------------------------------------------------- notifications */
export function NotificationsSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <PageHeader titleW="w-52" subW="w-80" />
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 p-4">
            <div className="h-9 w-9 shrink-0 rounded-full bg-foreground/10" aria-hidden />
            <div className="flex-1 space-y-2">
              <Bar className="h-4 w-40" />
              <Bar className="h-3 w-56 bg-foreground/[0.06]" />
              <Bar className="h-2.5 w-20 bg-foreground/[0.06]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
