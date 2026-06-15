"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db/client";
import { users } from "@db/schema";
import { cognitoCreateUser, cognitoLogin } from "@/server/auth/cognito";
import { setSessionCookies, clearSessionCookies } from "@/server/auth/session";
import { roleHome } from "@/server/auth/guard";
import {
  assertCodeValid,
  createUserRecord,
  redeemEmployeeCode,
  redeemTenantCode,
} from "@/server/services/onboarding";
import type { Role } from "@/server/auth/session";

export type AuthState = { error: string } | undefined;

const password = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[0-9]/, "Add a number")
  .regex(/[^A-Za-z0-9]/, "Add a symbol");

const baseSignup = z.object({
  fullName: z.string().trim().min(1, "Name required"),
  email: z.string().trim().email("Valid email required"),
  password,
});

function humanError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === "UsernameExistsException") return "An account with this email already exists.";
  if (name === "InvalidPasswordException")
    return "Password must be 12+ chars with upper, lower, number, and symbol.";
  const msg = (e as Error)?.message;
  return msg && msg.length < 160 ? msg : "Something went wrong. Please try again.";
}

async function finishSignup(email: string, pw: string) {
  const auth = await cognitoLogin(email, pw);
  await setSessionCookies(auth, email);
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z
    .object({ email: z.string().trim().email(), password: z.string().min(1) })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter a valid email and password." };
  const email = parsed.data.email.toLowerCase();
  try {
    const auth = await cognitoLogin(email, parsed.data.password);
    await setSessionCookies(auth, email);
  } catch {
    return { error: "Incorrect email or password." };
  }
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookies();
  redirect("/login");
}

export async function signupOwnerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const p = baseSignup.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!p.success) return { error: p.error.issues[0].message };
  const email = p.data.email.toLowerCase();
  try {
    const sub = await cognitoCreateUser(email, p.data.password, p.data.fullName, "owner");
    await createUserRecord({ cognitoSub: sub, email, role: "owner", fullName: p.data.fullName });
    await finishSignup(email, p.data.password);
  } catch (e) {
    return { error: humanError(e) };
  }
  redirect("/dashboard");
}

export async function signupEmployeeAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const p = baseSignup
    .extend({ code: z.string().trim().min(1, "Employer code required") })
    .safeParse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      password: formData.get("password"),
      code: formData.get("code"),
    });
  if (!p.success) return { error: p.error.issues[0].message };
  const email = p.data.email.toLowerCase();
  const code = p.data.code.toUpperCase();
  try {
    await assertCodeValid(code, "employee");
    const sub = await cognitoCreateUser(email, p.data.password, p.data.fullName, "employee");
    const u = await createUserRecord({ cognitoSub: sub, email, role: "employee", fullName: p.data.fullName });
    await redeemEmployeeCode(code, u.id);
    await finishSignup(email, p.data.password);
  } catch (e) {
    return { error: humanError(e) };
  }
  redirect("/jobs");
}

export async function signupTenantAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const p = baseSignup
    .extend({ code: z.string().trim().min(1, "Unit code required") })
    .safeParse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      password: formData.get("password"),
      code: formData.get("code"),
    });
  if (!p.success) return { error: p.error.issues[0].message };
  const email = p.data.email.toLowerCase();
  const code = p.data.code.toUpperCase();
  try {
    await assertCodeValid(code, "tenant");
    const sub = await cognitoCreateUser(email, p.data.password, p.data.fullName, "tenant");
    const u = await createUserRecord({ cognitoSub: sub, email, role: "tenant", fullName: p.data.fullName });
    await redeemTenantCode(code, u.id);
    await finishSignup(email, p.data.password);
  } catch (e) {
    return { error: humanError(e) };
  }
  redirect("/home");
}

/** DEV ONLY: quick-login as a seeded user of the chosen role. */
export async function devLoginAction(formData: FormData): Promise<void> {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_LOGIN !== "true") return;
  const role = String(formData.get("role")) as Role;
  // Prefer a real seeded user so DB-backed pages work as normal. If the DB is
  // unreachable (e.g. Aurora paused/IP-locked), fall back to a `dev:<role>`
  // sentinel so role UIs can still be developed fully offline.
  let cookieValue = `dev:${role}`;
  try {
    const [u] = await db.select().from(users).where(eq(users.role, role)).limit(1);
    if (u) cookieValue = u.id;
  } catch {
    // DB down — keep the synthetic sentinel.
  }
  (await cookies()).set("abode_dev_user", cookieValue, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect(roleHome(role));
}
