"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { User, Mail, Lock, KeyRound, ArrowRight, AlertCircle } from "lucide-react";
import { signupOwnerAction, signupEmployeeAction, signupTenantAction } from "@/actions/auth";
import type { Role } from "@/server/auth/session";
import { TextField, PasswordField } from "./fields";

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

export function SignupForm({ role }: { role: Role }) {
  const [state, action, pending] = useActionState(ACTIONS[role], undefined);
  // Controlled so a failed submit keeps what the user typed — React resets
  // uncontrolled fields after a form action completes.
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  return (
    <form action={action} className="grid gap-3">
      <TextField
        icon={User}
        name="fullName"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="Full name"
        autoComplete="name"
        required
      />
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
        placeholder="Password (8+ chars, 1 uppercase, 1 number)"
        autoComplete="new-password"
        required
      />
      {role !== "owner" && (
        <TextField
          icon={KeyRound}
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={CODE_LABEL[role]}
          required
        />
      )}
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
          "Creating account…"
        ) : (
          <>
            Create {LABEL[role]} account
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand transition hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
