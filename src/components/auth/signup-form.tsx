"use client";
import { useActionState } from "react";
import Link from "next/link";
import { signupOwnerAction, signupEmployeeAction, signupTenantAction } from "@/actions/auth";
import type { Role } from "@/server/auth/session";

const ACTIONS = {
  owner: signupOwnerAction,
  employee: signupEmployeeAction,
  tenant: signupTenantAction,
} as const;

const LABEL: Record<Role, string> = {
  owner: "Property Manager",
  employee: "Maintenance / Handyman",
  tenant: "Tenant",
};

const CODE_LABEL: Partial<Record<Role, string>> = {
  employee: "Employer code (from your property manager)",
  tenant: "Unit code (from your property manager)",
};

const input =
  "rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

export function SignupForm({ role }: { role: Role }) {
  const [state, action, pending] = useActionState(ACTIONS[role], undefined);
  return (
    <form action={action} className="grid gap-3">
      <input name="fullName" placeholder="Full name" required className={input} />
      <input name="email" type="email" placeholder="Email" required className={input} />
      <input
        name="password"
        type="password"
        placeholder="Password (12+ chars, upper/lower/number/symbol)"
        required
        className={input}
      />
      {role !== "owner" && (
        <input name="code" placeholder={CODE_LABEL[role]} required className={input} />
      )}
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        disabled={pending}
        className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-60"
      >
        {pending ? "Creating account…" : `Create ${LABEL[role]} account`}
      </button>
      <p className="text-center text-sm opacity-70">
        Already have an account?{" "}
        <Link href="/login" className="font-medium underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
