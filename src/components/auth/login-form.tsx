"use client";
import { useActionState } from "react";
import Link from "next/link";
import { loginAction, devLoginAction } from "@/actions/auth";

const input =
  "rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

export function LoginForm({ showDev }: { showDev: boolean }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <div className="grid gap-6">
      <form action={action} className="grid gap-3">
        <input name="email" type="email" placeholder="Email" required className={input} />
        <input name="password" type="password" placeholder="Password" required className={input} />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          disabled={pending}
          className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="text-center text-sm opacity-70">
        No account?{" "}
        <Link href="/signup" className="font-medium underline">
          Create one
        </Link>
      </p>

      {showDev && (
        <div className="rounded-lg border border-dashed border-black/20 p-3 dark:border-white/20">
          <p className="mb-2 text-xs opacity-60">Dev quick-login (seeded users)</p>
          <form className="grid grid-cols-3 gap-2">
            {(["owner", "employee", "tenant"] as const).map((r) => (
              <button
                key={r}
                formAction={devLoginAction}
                name="role"
                value={r}
                className="rounded-md border border-black/15 px-2 py-1.5 text-xs capitalize hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                {r}
              </button>
            ))}
          </form>
        </div>
      )}
    </div>
  );
}
