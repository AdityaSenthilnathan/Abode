import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Wallet,
  Wrench,
  LineChart,
  Heart,
  Receipt,
  Bell,
  TrendingUp,
  Check,
} from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { roleHome } from "@/server/auth/guard";
import { ThemeToggle } from "@/components/theme-toggle";
import { Backdrop, Wordmark } from "@/components/marketing/backdrop";

/** Owner outcomes — tenants & maintenance reframed as the owner's upside. */
const BENEFITS = [
  {
    icon: Wallet,
    t: "Get paid on time",
    d: "Rent & dues online, with reminders that chase for you.",
    accent: "from-brand/25 to-brand/5 text-brand",
  },
  {
    icon: Wrench,
    t: "Maintenance, handled",
    d: "A tenant photo becomes a dispatched job — estimate to receipt.",
    accent: "from-accent-2/30 to-accent-2/5 text-accent-2",
  },
  {
    icon: LineChart,
    t: "See it all at once",
    d: "Revenue, occupancy, and every unit on one live dashboard.",
    accent: "from-accent/30 to-accent/5 text-accent",
  },
  {
    icon: Heart,
    t: "Tenants who renew",
    d: "A portal residents love — so they stay longer, churn less.",
    accent: "from-brand/25 to-brand/5 text-brand",
  },
] as const;

/** The owner's dashboard, previewed — proof, not a promise. */
function ActivityRow({
  icon: Icon,
  tone,
  label,
  status,
}: {
  icon: typeof Receipt;
  tone: string;
  label: string;
  status: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex min-w-0 items-center gap-3 text-sm font-medium">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="truncate">{label}</span>
      </span>
      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${tone}`}>{status}</span>
    </div>
  );
}

function PreviewCard() {
  const bars = [40, 58, 46, 72, 62, 90, 80];
  return (
    <div className="glass animate-float w-full max-w-md rounded-[1.75rem] p-7 shadow-2xl shadow-brand/10">
      {/* header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold">Maple Court</div>
          <div className="mt-1 text-sm text-muted">12 units · West Loop</div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand">
          <Bell className="h-3.5 w-3.5" /> 4 new
        </span>
      </div>

      {/* focal stat + trend chart */}
      <div className="mt-8">
        <div className="text-sm text-muted">Collected this month</div>
        <div className="mt-1.5 flex items-baseline gap-2.5">
          <span className="text-[2.25rem] font-semibold leading-none tracking-tight">$48,200</span>
          <span className="inline-flex items-center gap-0.5 text-sm font-medium text-accent-2">
            <TrendingUp className="h-4 w-4" /> +12%
          </span>
        </div>
        <div className="mt-6 flex h-28 items-end gap-2.5">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-md bg-gradient-to-t from-brand/20 to-brand animate-fade-up"
              style={{ height: `${h}%`, animationDelay: `${0.3 + i * 0.06}s` }}
            />
          ))}
        </div>
      </div>

      {/* recent activity */}
      <div className="mt-8 space-y-5 border-t border-line pt-6">
        <ActivityRow icon={Receipt} tone="bg-accent-2/15 text-accent-2" label="Unit 4B · Rent" status="Paid" />
        <ActivityRow
          icon={Wrench}
          tone="bg-amber-500/15 text-amber-600 dark:text-amber-400"
          label="Leaky faucet"
          status="In progress"
        />
      </div>
    </div>
  );
}

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(roleHome(user.role));

  return (
    <div className="relative flex min-h-full flex-col">
      <Backdrop />

      {/* top nav */}
      <header className="animate-fade-in mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Wordmark />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-full border border-line bg-surface/60 px-4 py-2 text-sm font-medium backdrop-blur transition hover:bg-surface-2"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* hero — speaks directly to the owner */}
      <main className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-12 lg:grid-cols-2 lg:py-20">
        <div className="text-center lg:text-left">

          <h1
            className="animate-fade-up mt-6 text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl"
            style={{ animationDelay: "0.08s" }}
          >
            Everything you own,{" "}
            <span className="text-gradient">under one roof</span>.
          </h1>

          <p
            className="animate-fade-up mx-auto mt-5 max-w-md text-pretty text-lg text-muted lg:mx-0"
            style={{ animationDelay: "0.16s" }}
          >
            Everything the big management companies do — without the thousands in
            fees. Free to get started.
          </p>

          <div
            className="animate-fade-up mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start"
            style={{ animationDelay: "0.24s" }}
          >
            <Link
              href="/signup/owner"
              className="btn-sheen group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-accent px-6 py-3.5 text-sm font-semibold text-brand-foreground shadow-lg shadow-brand/30 transition hover:shadow-xl hover:shadow-brand/40 sm:w-auto"
            >
              Start free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface/60 px-6 py-3.5 text-sm font-semibold backdrop-blur transition hover:bg-surface-2 sm:w-auto"
            >
              Sign in
            </Link>
          </div>

          <div
            className="animate-fade-up mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted lg:justify-start"
            style={{ animationDelay: "0.32s" }}
          >
            {["Free to start", "No credit card", "Set up in minutes"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-accent-2" />
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <div className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
            <PreviewCard />
          </div>
        </div>
      </main>

      {/* owner outcomes */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-8 pt-4">
        <div className="mb-8 text-center">
          <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            Run more doors with less of your day
          </h2>
          <p className="mx-auto mt-2 max-w-md text-pretty text-muted">
            The tools a management company charges thousands for — built for owners
            who&apos;d rather keep that money. Tenants and crew each get their own
            app; you get the control room they feed into.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((c, i) => (
            <div
              key={c.t}
              className="card-lift animate-fade-up group relative overflow-hidden rounded-2xl border border-line bg-surface/60 p-6 backdrop-blur"
              style={{ animationDelay: `${0.08 + i * 0.07}s` }}
            >
              <div
                className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${c.accent} opacity-60 blur-2xl`}
              />
              <span
                className={`relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${c.accent}`}
              >
                <c.icon className="h-5 w-5" />
              </span>
              <div className="relative mt-4 font-semibold">{c.t}</div>
              <p className="relative mt-2 text-sm leading-relaxed text-muted">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* closing conversion band */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-20 pt-8">
        <div className="glass-strong relative overflow-hidden rounded-3xl px-8 py-12 text-center shadow-xl shadow-brand/10">
          <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-[36rem] max-w-full rounded-full bg-gradient-to-br from-brand/30 to-accent/20 opacity-70 blur-3xl" />
          <h2 className="relative text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Get your weekends back.
          </h2>
          <p className="relative mx-auto mt-3 max-w-sm text-pretty text-muted">
            Set up your first property in minutes. No contracts, no per-unit fees —
            start free and let Abode handle the busywork.
          </p>
          <div className="relative mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup/owner"
              className="btn-sheen group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-accent px-7 py-3.5 text-sm font-semibold text-brand-foreground shadow-lg shadow-brand/30 transition hover:shadow-xl hover:shadow-brand/40"
            >
              Create your owner account
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-muted transition hover:text-foreground"
            >
              Already with Abode? Sign in
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 border-t border-line/60 px-6 py-6 text-sm text-muted sm:flex-row">
        <Wordmark size="sm" />
        <span>Property management that finally feels like home.</span>
      </footer>
    </div>
  );
}
