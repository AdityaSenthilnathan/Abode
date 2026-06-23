"use server";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db/client";
import { users } from "@db/schema";
import { cognitoCreateUser, cognitoLogin } from "@/server/auth/cognito";
import { setSessionCookies, clearSessionCookies } from "@/server/auth/session";
import { roleHome } from "@/server/auth/guard";
import { demoLogin, authLog } from "@/server/config";
import {
  assertCodeValid,
  createUserRecord,
  redeemEmployeeCode,
  redeemTenantCode,
} from "@/server/services/onboarding";
import type { Role } from "@/server/auth/session";

/**
 * Cookie options for the seeded-user session cookie that demo/dev login sets.
 *
 * `secure` is keyed off the ACTUAL request protocol, not NODE_ENV. A production
 * build served over plain HTTP — the local preview opened via its LAN URL
 * (http://192.168.x:3001), or Safari on http://localhost — would otherwise get
 * a Secure cookie the browser refuses to store on a non-HTTPS origin, so the
 * session never sticks and every navigation bounces to /login. Behind a real
 * HTTPS proxy (App Runner) `x-forwarded-proto` is "https", so it stays Secure
 * in actual production.
 */
async function demoCookieOpts() {
  const proto = (await headers()).get("x-forwarded-proto")?.split(",")[0].trim();
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: proto === "https",
    path: "/",
    // Persist for 30 days rather than being a session cookie, so a demo session
    // survives tab/browser restarts instead of silently dropping.
    maxAge: 60 * 60 * 24 * 30,
  };
}

export type AuthState = { error: string } | undefined;

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[0-9]/, "Add a number");

const baseSignup = z.object({
  fullName: z.string().trim().min(1, "Name required"),
  email: z.string().trim().email("Valid email required"),
  password,
});

function humanError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === "UsernameExistsException") return "An account with this email already exists.";
  // Postgres unique-violation (dev bypass inserts the users row directly).
  if ((e as { code?: string })?.code === "23505")
    return "An account with this email already exists.";
  if (name === "InvalidPasswordException")
    return "Password must be 8+ characters with an uppercase letter and a number.";
  const msg = (e as Error)?.message;
  return msg && msg.length < 160 ? msg : "Something went wrong. Please try again.";
}

/**
 * Dev-only escape hatch: when ALLOW_DEV_LOGIN is on (and not production), skip
 * Cognito entirely. Real Cognito calls need AWS credentials, which the local
 * machine may not have — without this, signup dies with "Could not load
 * credentials from any providers." Mirrors demoLoginAction / getCurrentUser.
 */
function devAuthBypass(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_LOGIN === "true";
}

/**
 * Create the auth identity + local users row for a signup. Dev bypass mints a
 * synthetic sub and skips Cognito; the real path admin-creates the Cognito user
 * first. Returns the new users row.
 */
async function createAccount(email: string, pw: string, fullName: string, role: Role) {
  const cognitoSub = devAuthBypass()
    ? `dev:${randomUUID()}`
    : await cognitoCreateUser(email, pw, fullName, role);
  return createUserRecord({ cognitoSub, email, role, fullName });
}

/**
 * Start a session for a freshly created user. Dev bypass sets the same
 * `abode_dev_user` cookie that demoLoginAction/getCurrentUser use; the real path
 * logs in via Cognito to obtain token cookies.
 */
async function startSession(user: { id: string }, email: string, pw: string) {
  if (devAuthBypass()) {
    (await cookies()).set("abode_dev_user", user.id, await demoCookieOpts());
    return;
  }
  const auth = await cognitoLogin(email, pw);
  await setSessionCookies(auth, email);
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z
    .object({ email: z.string().trim().email(), password: z.string().min(1) })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter a valid email and password." };
  const email = parsed.data.email.toLowerCase();

  // Dev bypass: real Cognito login needs AWS creds the local box may lack, and
  // dev signups never set a Cognito password to verify against. Log a known
  // local user in by email alone — the same no-password trust model as the dev
  // quick-login buttons. The password field is ignored here; in production
  // Cognito enforces it (this branch is dead when ALLOW_DEV_LOGIN is off).
  if (devAuthBypass()) {
    let row: { id: string; role: Role } | undefined;
    try {
      [row] = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
    } catch {
      return { error: "Dev DB unavailable — is Postgres running and seeded?" };
    }
    if (!row) return { error: "No account with that email yet — sign up first." };
    (await cookies()).set("abode_dev_user", row.id, await demoCookieOpts());
    redirect(roleHome(row.role));
  }

  try {
    const auth = await cognitoLogin(email, parsed.data.password);
    await setSessionCookies(auth, email);
  } catch {
    return { error: "Incorrect email or password." };
  }
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  authLog("logoutAction — clearing session cookies (user signed out)");
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
    const user = await createAccount(email, p.data.password, p.data.fullName, "owner");
    await startSession(user, email, p.data.password);
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
    const user = await createAccount(email, p.data.password, p.data.fullName, "employee");
    await redeemEmployeeCode(code, user.id);
    await startSession(user, email, p.data.password);
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
    const user = await createAccount(email, p.data.password, p.data.fullName, "tenant");
    await redeemTenantCode(code, user.id);
    await startSession(user, email, p.data.password);
  } catch (e) {
    return { error: humanError(e) };
  }
  redirect("/home");
}

/**
 * Demo quick-login as a seeded user of the chosen role. Allowed in production
 * when ALLOW_DEMO_LOGIN is set (see `demoLogin()`), so the live site can offer a
 * one-click "try it" experience. Logs into an existing seeded row only — never
 * creates an account or touches Cognito.
 */
export async function demoLoginAction(formData: FormData): Promise<void> {
  const role = String(formData.get("role")) as Role;
  const enabled = demoLogin();
  authLog("demoLoginAction — clicked role:", role, "| demoLogin() =", enabled);
  if (!enabled) {
    authLog("  ✗ demo login is DISABLED — click ignored (set ALLOW_DEMO_LOGIN/ALLOW_DEV_LOGIN)");
    return;
  }
  // Prefer a real seeded user so DB-backed pages work as normal. If the DB is
  // unreachable (e.g. Aurora paused/IP-locked), fall back to a `dev:<role>`
  // sentinel so role UIs can still be developed fully offline.
  let cookieValue = `dev:${role}`;
  try {
    const [u] = await db.select().from(users).where(eq(users.role, role)).limit(1);
    if (u) {
      cookieValue = u.id;
      authLog("  DB lookup OK — seeded", role, "id:", u.id);
    } else {
      authLog("  ✗ no seeded user with role", role, "— using sentinel", cookieValue);
    }
  } catch (e) {
    authLog("  ✗ DB lookup FAILED (DB down) — using sentinel", cookieValue, "|", (e as Error).message);
  }
  authLog("  setting cookie abode_dev_user =", cookieValue, "→ redirecting to", roleHome(role));
  (await cookies()).set("abode_dev_user", cookieValue, await demoCookieOpts());
  redirect(roleHome(role));
}
