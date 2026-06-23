import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import type { AuthenticationResultType } from "@aws-sdk/client-cognito-identity-provider";
import { db } from "@/server/db/client";
import { users } from "@db/schema";
import { demoLogin } from "@/server/config";
import { verifyAccessToken } from "./verify";
import { cognitoRefresh } from "./cognito";

export type Role = "owner" | "employee" | "tenant";

export interface SessionUser {
  id: string;
  role: Role;
  email: string;
  fullName: string | null;
}

const AT = "abode_at"; // access token
const RT = "abode_rt"; // refresh token
const UN = "abode_un"; // username (email), for refresh

/** Store Cognito tokens in httpOnly cookies after login/signup. */
export async function setSessionCookies(auth: AuthenticationResultType, email: string) {
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  const base = { httpOnly: true as const, sameSite: "lax" as const, secure, path: "/" };
  if (auth.AccessToken) jar.set(AT, auth.AccessToken, { ...base, maxAge: auth.ExpiresIn ?? 3600 });
  if (auth.RefreshToken) jar.set(RT, auth.RefreshToken, { ...base, maxAge: 30 * 24 * 3600 });
  jar.set(UN, email, { ...base, maxAge: 30 * 24 * 3600 });
}

export async function clearSessionCookies() {
  const jar = await cookies();
  // Drop any cached user for these credentials so a logout takes effect now
  // rather than lingering for the cache TTL.
  for (const k of cacheKeysFor(jar)) userCache.delete(k);
  for (const n of [AT, RT, UN, "abode_dev_user"]) jar.delete(n);
}

async function userBySub(sub: string): Promise<SessionUser | null> {
  const [u] = await db.select().from(users).where(eq(users.cognitoSub, sub)).limit(1);
  return u ? { id: u.id, role: u.role, email: u.email, fullName: u.fullName } : null;
}

/**
 * Cross-request user cache. React `cache()` only dedupes within a single
 * request; without this, every navigation re-verifies the token and round-trips
 * to Aurora (us-west-1, scale-to-zero) just to resolve the same user. Keyed by
 * the credential itself (access token / refresh token / dev cookie), so entries
 * are never shared across sessions. Short TTL bounds how long a role/profile
 * change or revoked token can be served stale.
 */
const USER_CACHE_TTL_MS = 30_000;
const USER_CACHE_MAX = 5_000;
const userCache = new Map<string, { user: SessionUser; expires: number }>();

type CookieJar = Awaited<ReturnType<typeof cookies>>;

/** The cache keys a given cookie jar could resolve under (most-trusted first). */
function cacheKeysFor(jar: CookieJar): string[] {
  const keys: string[] = [];
  const at = jar.get(AT)?.value;
  const rt = jar.get(RT)?.value;
  const dev = jar.get("abode_dev_user")?.value;
  if (at) keys.push(`at:${at}`);
  if (rt) keys.push(`rt:${rt}`);
  if (dev) keys.push(`dev:${dev}`);
  return keys;
}

function cacheGet(key: string): SessionUser | null {
  const hit = userCache.get(key);
  if (!hit) return null;
  if (hit.expires <= Date.now()) {
    userCache.delete(key);
    return null;
  }
  return hit.user;
}

function cacheSet(key: string, user: SessionUser) {
  if (userCache.size >= USER_CACHE_MAX) {
    const now = Date.now();
    for (const [k, v] of userCache) if (v.expires <= now) userCache.delete(k);
  }
  userCache.set(key, { user, expires: Date.now() + USER_CACHE_TTL_MS });
}

/**
 * Resolve the current user. Primary path: verify the Cognito access-token
 * cookie and map its `sub` to the local users row.
 *
 * Demo fallback (when `demoLogin()` is on — i.e. ALLOW_DEMO_LOGIN in prod, or
 * the dev bypass locally): an `abode_dev_user` cookie naming a seeded user id,
 * which lets a visitor explore a role without a real Cognito account.
 *
 * Memoized per server request via React `cache()`: a layout and the page it
 * wraps both call this on every navigation, and without memoization that's
 * two identical token verifications + DB lookups.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();

  // Fast path: a recent navigation already resolved this exact credential.
  for (const k of cacheKeysFor(jar)) {
    const cached = cacheGet(k);
    if (cached) return cached;
  }

  const at = jar.get(AT)?.value;
  if (at) {
    try {
      const claims = await verifyAccessToken(at);
      const u = await userBySub(claims.sub);
      if (u) {
        cacheSet(`at:${at}`, u);
        return u;
      }
    } catch {
      // access token expired/invalid — try the refresh token below.
    }
  }

  // Keep a real session alive past access-token expiry instead of bouncing the
  // user to /login. We can't persist the rotated token here (cookies are
  // read-only during render), so the next login or token-setting Server Action
  // re-seeds the cookie; until then this refreshes per request.
  const rt = jar.get(RT)?.value;
  const un = jar.get(UN)?.value;
  if (rt && un) {
    try {
      const refreshed = await cognitoRefresh(rt, un);
      if (refreshed?.AccessToken) {
        const claims = await verifyAccessToken(refreshed.AccessToken);
        const u = await userBySub(claims.sub);
        if (u) {
          // Cache under the refresh token so subsequent navigations skip the
          // Cognito refresh round-trip too, not just the DB lookup.
          cacheSet(`rt:${rt}`, u);
          return u;
        }
      }
    } catch {
      // refresh token revoked/expired — fall through to dev/null.
    }
  }

  if (demoLogin()) {
    const devId = jar.get("abode_dev_user")?.value;
    if (devId) {
      try {
        const [u] = await db.select().from(users).where(eq(users.id, devId)).limit(1);
        if (u) {
          const su = { id: u.id, role: u.role, email: u.email, fullName: u.fullName };
          cacheSet(`dev:${devId}`, su);
          return su;
        }
      } catch {
        // DB not ready
      }
    }
  }

  return null;
});
