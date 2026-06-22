import { Sparkles, Check } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

const PERKS = [
  "Revenue, dues, and occupancy at a glance",
  "Maintenance from request to receipt",
  "Real-time chat across every role",
];

export default function LoginPage() {
  const showDev = process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_LOGIN === "true";
  return (
    <div className="animate-fade-up w-full max-w-4xl">
      <div className="glass-strong grid overflow-hidden rounded-3xl shadow-2xl shadow-brand/10 md:grid-cols-2">
        {/* brand panel — hidden on small screens */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand via-brand to-accent p-9 text-brand-foreground md:flex">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-accent-2/30 blur-3xl" />

          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Welcome back
            </span>
            <h2 className="mt-6 text-3xl font-semibold leading-tight tracking-tight">
              Everything your
              <br />
              property needs.
            </h2>
            <p className="mt-3 max-w-xs text-sm text-brand-foreground/80">
              Pick up right where you left off — your portfolio, tenants, and tasks are ready.
            </p>
          </div>

          <ul className="relative mt-8 space-y-3">
            {PERKS.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-brand-foreground/90">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <Check className="h-3 w-3" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* form panel */}
        <div className="p-8 sm:p-10">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">Sign in to Abode</h1>
            <p className="mt-1 text-sm text-muted">Enter your details to continue.</p>
          </div>
          <LoginForm showDev={showDev} />
        </div>
      </div>
    </div>
  );
}
