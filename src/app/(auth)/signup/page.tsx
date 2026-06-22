import Link from "next/link";
import { Building2, Wrench, KeyRound, ArrowRight } from "lucide-react";

const ROLES = [
  {
    href: "/signup/owner",
    icon: Building2,
    t: "Property Manager",
    d: "Manage properties, tenants, dues, and maintenance.",
    accent: "from-brand/15 to-brand/0 text-brand",
  },
  {
    href: "/signup/employee",
    icon: Wrench,
    t: "Maintenance / Handyman",
    d: "Join with an employer code from a manager.",
    accent: "from-accent-2/20 to-accent-2/0 text-accent-2",
  },
  {
    href: "/signup/tenant",
    icon: KeyRound,
    t: "Tenant",
    d: "Join your unit with a code from your manager.",
    accent: "from-accent/20 to-accent/0 text-accent",
  },
];

export default function SignupChooser() {
  return (
    <div className="animate-fade-up w-full max-w-lg">
      <div className="glass-strong rounded-3xl p-8 shadow-2xl shadow-brand/10 sm:p-10">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
          <p className="text-sm text-muted">Choose how you&apos;ll use Abode.</p>
        </div>
        <div className="mt-6 grid gap-3">
          {ROLES.map((r, i) => (
            <Link
              key={r.href}
              href={r.href}
              style={{ animationDelay: `${0.08 + i * 0.07}s` }}
              className="card-lift animate-fade-up group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-line bg-surface/60 p-4"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${r.accent}`}
              >
                <r.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="font-medium">{r.t}</div>
                <div className="mt-0.5 text-sm text-muted">{r.d}</div>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 shrink-0 -translate-x-1 text-muted opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
            </Link>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand transition hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
