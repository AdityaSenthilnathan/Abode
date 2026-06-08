import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { roleHome } from "@/server/auth/guard";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(roleHome(user.role));

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">Abode</h1>
        <p className="text-lg opacity-70">
          One platform for property owners, maintenance staff, and tenants — rent &amp; dues,
          maintenance requests, tasks, and messaging in one place.
        </p>
      </div>
      <div className="grid w-full gap-4 sm:grid-cols-3">
        {[
          { t: "Owners", d: "Run your properties: revenue, tenants, fix-it tasks, and chat." },
          { t: "Maintenance", d: "Accept jobs, send estimates, log receipts, get paid." },
          { t: "Tenants", d: "Pay dues, file requests with photos, track their status." },
        ].map((c) => (
          <div
            key={c.t}
            className="rounded-xl border border-black/10 p-5 text-left dark:border-white/15"
          >
            <div className="font-medium">{c.t}</div>
            <div className="mt-1 text-sm opacity-70">{c.d}</div>
          </div>
        ))}
      </div>
      <Link
        href="/login"
        className="rounded-lg bg-foreground px-6 py-3 text-background transition-opacity hover:opacity-90"
      >
        Sign in
      </Link>
    </div>
  );
}
