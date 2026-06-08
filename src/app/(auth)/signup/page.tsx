import Link from "next/link";

const ROLES = [
  { href: "/signup/owner", t: "Property Manager", d: "Manage properties, tenants, dues, and maintenance." },
  { href: "/signup/employee", t: "Maintenance / Handyman", d: "Join with an employer code from a manager." },
  { href: "/signup/tenant", t: "Tenant", d: "Join your unit with a code from your manager." },
];

export default function SignupChooser() {
  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-6 px-6 py-24">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm opacity-60">Choose how you&apos;ll use Abode.</p>
      </div>
      <div className="grid gap-3">
        {ROLES.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="rounded-xl border border-black/10 p-4 transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
          >
            <div className="font-medium">{r.t}</div>
            <div className="mt-0.5 text-sm opacity-70">{r.d}</div>
          </Link>
        ))}
      </div>
      <p className="text-center text-sm opacity-70">
        Already have an account?{" "}
        <Link href="/login" className="font-medium underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
