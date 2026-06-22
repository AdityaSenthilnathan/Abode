"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Mail, Lock, ArrowRight, Building2, Wrench, KeyRound, AlertCircle } from "lucide-react";
import { loginAction, devLoginAction } from "@/actions/auth";
import { TextField, PasswordField } from "./fields";

const DEV_ROLES = [
  { role: "owner", label: "Owner", icon: Building2 },
  { role: "employee", label: "Handyman", icon: Wrench },
  { role: "tenant", label: "Tenant", icon: KeyRound },
] as const;

export function LoginForm({ showDev }: { showDev: boolean }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  // Controlled so a failed sign-in keeps the email/password instead of clearing.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="grid gap-5">
      <form action={action} className="grid gap-3">
        <TextField
          icon={Mail}
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          required
        />
        <PasswordField
          icon={Lock}
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          required
        />
        {state?.error && (
          <p className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {state.error}
          </p>
        )}
        <button
          disabled={pending}
          className="btn-sheen group mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-accent px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-lg shadow-brand/30 transition hover:shadow-xl hover:shadow-brand/40 disabled:opacity-60"
        >
          {pending ? (
            "Signing in…"
          ) : (
            <>
              Sign in
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        No account?{" "}
        <Link href="/signup" className="font-medium text-brand transition hover:underline">
          Create one
        </Link>
      </p>

      {showDev && (
        <div className="rounded-xl border border-dashed border-line bg-surface/40 p-3">
          <p className="mb-2 text-center text-xs text-muted">Dev quick-login · seeded users</p>
          <div className="grid grid-cols-3 gap-2">
            {DEV_ROLES.map(({ role, label, icon: Icon }) => (
              <form key={role} action={devLoginAction}>
                <input type="hidden" name="role" value={role} />
                <button className="flex w-full flex-col items-center gap-1 rounded-lg border border-line bg-surface/60 px-2 py-2 text-xs font-medium text-muted transition hover:border-brand/50 hover:bg-surface-2 hover:text-foreground">
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              </form>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
