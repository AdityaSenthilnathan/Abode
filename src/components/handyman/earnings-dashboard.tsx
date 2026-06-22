"use client";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, CheckCircle2, CreditCard, PieChart, TrendingUp, Wallet } from "lucide-react";
import { formatCents } from "@/lib/utils";
import type { Earning, PayoutCard } from "@/server/services/earnings";
import { addPayoutCardAction } from "@/actions/earnings";

type Timeframe = "month" | "3m" | "year" | "all";
const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: "month", label: "This month" },
  { key: "3m", label: "Last 3 months" },
  { key: "year", label: "Last year" },
  { key: "all", label: "All time" },
];

const PALETTE = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#ec4899", "#14b8a6"];

interface Bucket {
  label: string;
  value: number;
}

/** Build the over-time series: day buckets for "this month", month buckets otherwise. */
function buildBuckets(earnings: Earning[], tf: Timeframe, now: Date): Bucket[] {
  if (tf === "month") {
    const y = now.getFullYear();
    const m = now.getMonth();
    const days = new Date(y, m + 1, 0).getDate();
    const arr: Bucket[] = Array.from({ length: days }, (_, i) => ({ label: `${i + 1}`, value: 0 }));
    for (const e of earnings) {
      const d = new Date(e.completedAt);
      if (d.getFullYear() === y && d.getMonth() === m) arr[d.getDate() - 1].value += e.amountCents;
    }
    return arr;
  }
  let monthsBack = tf === "3m" ? 3 : tf === "year" ? 12 : 12;
  if (tf === "all") {
    const earliest = earnings.reduce<number>((min, e) => Math.min(min, new Date(e.completedAt).getTime()), now.getTime());
    const months = (now.getFullYear() - new Date(earliest).getFullYear()) * 12 + (now.getMonth() - new Date(earliest).getMonth()) + 1;
    monthsBack = Math.min(Math.max(months, 1), 24);
  }
  const arr: Bucket[] = [];
  const idx = new Map<string, number>();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    idx.set(`${d.getFullYear()}-${d.getMonth()}`, arr.length);
    arr.push({ label: d.toLocaleString(undefined, { month: "short" }), value: 0 });
  }
  for (const e of earnings) {
    const d = new Date(e.completedAt);
    const k = `${d.getFullYear()}-${d.getMonth()}`;
    if (idx.has(k)) arr[idx.get(k)!].value += e.amountCents;
  }
  return arr;
}

function Donut({
  segments,
  total,
  hoverIdx,
  onHover,
}: {
  segments: { label: string; value: number; color: string }[];
  total: number;
  hoverIdx: number | null;
  onHover: (i: number | null) => void;
}) {
  // r + max strokeWidth/2 must stay within the 60 half-viewBox or the ring clips.
  const r = 50;
  const c = 2 * Math.PI * r;
  let acc = 0;
  const active = hoverIdx != null ? segments[hoverIdx] : null;
  const centerValue = active ? active.value : total;
  const centerLabel = active ? active.label.toUpperCase() : "TOTAL";
  return (
    <svg viewBox="0 0 120 120" className="h-44 w-44 shrink-0">
      <g transform="rotate(-90 60 60)">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="13" />
        {segments.map((s, i) => {
          const len = total > 0 ? (s.value / total) * c : 0;
          const el = (
            <circle
              key={i}
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={hoverIdx === i ? 16 : 13}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-acc}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
              style={{
                cursor: "pointer",
                opacity: hoverIdx == null || hoverIdx === i ? 1 : 0.3,
                transition: "opacity .15s ease, stroke-width .15s ease",
              }}
            />
          );
          acc += len;
          return el;
        })}
      </g>
      <text x="60" y="58" textAnchor="middle" style={{ fontSize: 13, fontWeight: 700, fill: "var(--foreground)" }}>
        {formatCents(centerValue)}
      </text>
      <text x="60" y="71" textAnchor="middle" style={{ fontSize: 6, fill: "var(--muted)", letterSpacing: 0.5 }}>
        {centerLabel.length > 18 ? `${centerLabel.slice(0, 17)}…` : centerLabel}
      </text>
    </svg>
  );
}

function Bars({ data }: { data: Bucket[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const labelEvery = data.length > 14 ? Math.ceil(data.length / 10) : 1;
  return (
    <div className="flex h-44 items-end gap-1">
      {data.map((d, i) => (
        <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          <div className="flex w-full flex-1 items-end">
            <div
              className="relative w-full rounded-t-md bg-brand/75 transition-colors group-hover:bg-brand"
              style={{ height: `${Math.max((d.value / max) * 100, d.value > 0 ? 4 : 0)}%` }}
            >
              {d.value > 0 && (
                <span className="pointer-events-none absolute -top-6 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background opacity-0 transition group-hover:opacity-100">
                  {formatCents(d.value)}
                </span>
              )}
            </div>
          </div>
          <span className="h-3 text-[9px] leading-none text-muted">{i % labelEvery === 0 ? d.label : ""}</span>
        </div>
      ))}
    </div>
  );
}

export function EarningsDashboard({ earnings, payout }: { earnings: Earning[]; payout: PayoutCard | null }) {
  const [tf, setTf] = useState<Timeframe>("month");
  const [mode, setMode] = useState<"total" | "monthly">("total");
  const [chart, setChart] = useState<"wheel" | "time">("wheel");
  const [hoverSeg, setHoverSeg] = useState<number | null>(null);
  const [showCardForm, setShowCardForm] = useState(!payout);

  // After saving (payout changes), drop the form to reveal the saved card.
  // "Update card" flips this back without re-firing (last4 unchanged).
  useEffect(() => {
    setShowCardForm(!payout);
  }, [payout?.last4]);

  const now = useMemo(() => new Date(), []);

  const start = useMemo(() => {
    const d = new Date(now);
    if (tf === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
    if (tf === "3m") d.setMonth(d.getMonth() - 3);
    else if (tf === "year") d.setFullYear(d.getFullYear() - 1);
    else return new Date(0);
    return d;
  }, [tf, now]);

  const filtered = useMemo(
    () => earnings.filter((e) => new Date(e.completedAt) >= start),
    [earnings, start],
  );

  const total = filtered.reduce((s, e) => s + e.amountCents, 0);
  const months = tf === "month" ? 1 : tf === "3m" ? 3 : tf === "year" ? 12 : Math.max(1, new Set(filtered.map((e) => new Date(e.completedAt).toISOString().slice(0, 7))).size);
  const monthly = Math.round(total / months);

  const byProperty = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of filtered) m.set(e.propertyName, (m.get(e.propertyName) ?? 0) + e.amountCents);
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }));
  }, [filtered]);

  const buckets = useMemo(() => buildBuckets(filtered, tf, now), [filtered, tf, now]);

  const seg = (k: string, label: string, active: boolean, onClick: () => void) => (
    <button
      key={k}
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-brand text-brand-foreground shadow-sm" : "text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* timeframe + mode controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-line bg-surface p-1">
          {TIMEFRAMES.map((t) => seg(t.key, t.label, tf === t.key, () => setTf(t.key)))}
        </div>
        <div className="inline-flex rounded-xl border border-line bg-surface p-1">
          {seg("total", "Total", mode === "total", () => setMode("total"))}
          {seg("monthly", "Monthly", mode === "monthly", () => setMode("monthly"))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* chart card */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted">
                {mode === "total" ? "Total earned" : "Monthly average"} · {TIMEFRAMES.find((t) => t.key === tf)?.label}
              </div>
              <div className="text-3xl font-bold tracking-tight">{formatCents(mode === "total" ? total : monthly)}</div>
            </div>
            <div className="inline-flex rounded-lg border border-line p-0.5">
              <button
                type="button"
                onClick={() => setChart("wheel")}
                aria-label="Wheel chart"
                className={`flex h-8 w-8 items-center justify-center rounded-md transition ${chart === "wheel" ? "bg-brand text-brand-foreground" : "text-muted hover:text-foreground"}`}
              >
                <PieChart className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setChart("time")}
                aria-label="Over-time chart"
                className={`flex h-8 w-8 items-center justify-center rounded-md transition ${chart === "time" ? "bg-brand text-brand-foreground" : "text-muted hover:text-foreground"}`}
              >
                <BarChart3 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="grid h-44 place-items-center text-sm text-muted">No earnings in this period yet.</div>
          ) : chart === "wheel" ? (
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
              <Donut segments={byProperty} total={total} hoverIdx={hoverSeg} onHover={setHoverSeg} />
              <ul className="w-full space-y-1">
                {byProperty.map((s, i) => (
                  <li
                    key={s.label}
                    onMouseEnter={() => setHoverSeg(i)}
                    onMouseLeave={() => setHoverSeg(null)}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                      hoverSeg === i ? "bg-surface-2" : ""
                    }`}
                    style={{ opacity: hoverSeg == null || hoverSeg === i ? 1 : 0.45 }}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="flex-1 truncate">{s.label}</span>
                    <span className="font-medium">{formatCents(s.value)}</span>
                    <span className="w-10 text-right text-xs text-muted">{Math.round((s.value / total) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <Bars data={buckets} />
              <p className="mt-2 text-center text-xs text-muted">Payments by {tf === "month" ? "day" : "month"} — hover a bar for the amount</p>
            </>
          )}
        </div>

        {/* side column: stats + payout */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-brand" /> Summary
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted">Total earned</dt>
                <dd className="font-semibold">{formatCents(total)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">Monthly average</dt>
                <dd className="font-semibold">{formatCents(monthly)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">Jobs completed</dt>
                <dd className="font-semibold">{filtered.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">Properties</dt>
                <dd className="font-semibold">{byProperty.length}</dd>
              </div>
            </dl>
          </div>

          {/* payout card */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Wallet className="h-4 w-4 text-brand" /> Payout method
            </div>
            {payout && !showCardForm ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 p-3">
                  <span className="flex h-9 w-12 items-center justify-center rounded-md bg-foreground text-background">
                    <CreditCard className="h-4 w-4" />
                  </span>
                  <div className="text-sm">
                    <div className="font-medium">
                      {payout.brand} •••• {payout.last4}
                    </div>
                    <div className="text-xs text-muted">
                      Expires {String(payout.expMonth).padStart(2, "0")}/{String(payout.expYear).slice(-2)}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCardForm(true)}
                  className="text-xs font-medium text-brand hover:underline"
                >
                  Update card
                </button>
              </div>
            ) : (
              <form action={addPayoutCardAction} className="mt-4 space-y-2.5">
                <input
                  name="number"
                  inputMode="numeric"
                  placeholder="Card number"
                  required
                  className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none transition focus:border-brand"
                />
                <input
                  name="exp"
                  placeholder="MM/YY"
                  required
                  className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none transition focus:border-brand"
                />
                <button className="w-full rounded-lg bg-brand py-2 text-sm font-semibold text-brand-foreground transition hover:brightness-110">
                  Save payout card
                </button>
                <p className="text-center text-[11px] text-muted">Test mode — no real charge.</p>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* completed projects */}
      <div>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Completed projects
          <span className="text-muted">· {filtered.length}</span>
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted">No completed projects in this period.</p>
        ) : (
          <div className="max-h-[22vh] space-y-3 overflow-y-auto pr-1">
            {filtered.map((e) => (
              <div
                key={e.taskId}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{e.title ?? "Maintenance job"}</div>
                  <div className="truncate text-xs text-muted">
                    {e.propertyName} · {new Date(e.completedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="shrink-0 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatCents(e.amountCents)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
