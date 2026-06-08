import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { users } from "@db/schema";
import { roleHome, type Role } from "@/server/auth/guard";

/**
 * DEV login. Picks a seeded user of the chosen role and sets the dev cookie.
 * Replaced in M1 by the real Cognito hosted-login flow. Disabled in production.
 */
async function devLogin(formData: FormData) {
  "use server";
  if (process.env.NODE_ENV === "production") return;

  const role = String(formData.get("role")) as Role;
  const [u] = await db.select().from(users).where(eq(users.role, role)).limit(1);
  if (!u) return;

  (await cookies()).set("abode_dev_user", u.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  redirect(roleHome(role));
}

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 px-6 py-24">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to Abode</h1>
        <p className="text-sm opacity-60">
          Dev mode — pick a seeded role. Real Cognito sign-in arrives in M1.
        </p>
      </div>
      <form action={devLogin} className="grid gap-3">
        {(
          [
            { role: "owner", label: "Continue as Property Manager" },
            { role: "employee", label: "Continue as Maintenance / Handyman" },
            { role: "tenant", label: "Continue as Tenant" },
          ] as const
        ).map((b) => (
          <button
            key={b.role}
            name="role"
            value={b.role}
            className="rounded-lg border border-black/15 px-4 py-3 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            {b.label}
          </button>
        ))}
      </form>
      <p className="text-center text-xs opacity-50">
        Buttons need the dev DB seeded (<code>npm run db:seed</code>).
      </p>
    </div>
  );
}
