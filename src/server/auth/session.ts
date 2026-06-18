import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import type { AuthenticationResultType } from "@aws-sdk/client-cognito-identity-provider";
import { db } from "@/server/db/client";
import { users } from "@db/schema";
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
  for (const n of [AT, RT, UN, "abode_dev_user"]) jar.delete(n);
}

async function userBySub(sub: string): Promise<SessionUser | null> {
  const [u] = await db.select().from(users).where(eq(users.cognitoSub, sub)).limit(1);
  return u ? { id: u.id, role: u.role, email: u.email, fullName: u.fullName } : null;
}

/**
 * Resolve the current user. Primary path: verify the Cognito access-token
 * cookie and map its `sub` to the local users row.
 *
 * Dev fallback (only when ALLOW_DEV_LOGIN=true and not production): an
 * `abode_dev_user` cookie naming a seeded user id — lets us exercise role UIs
 * without creating real Cognito accounts.
 *
 * Memoized per server request via React `cache()`: a layout and the page it
 * wraps both call this on every navigation, and without memoization that's
 * two identical token verifications + DB lookups.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();

  const at = jar.get(AT)?.value;
  if (at) {
    try {
      const claims = await verifyAccessToken(at);
      const u = await userBySub(claims.sub);
      if (u) return u;
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
        if (u) return u;
      }
    } catch {
      // refresh token revoked/expired — fall through to dev/null.
    }
  }

  if (process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_LOGIN === "true") {
    const devId = jar.get("abode_dev_user")?.value;
    if (devId) {
      try {
        const [u] = await db.select().from(users).where(eq(users.id, devId)).limit(1);
        if (u) return { id: u.id, role: u.role, email: u.email, fullName: u.fullName };
      } catch {
        // DB not ready
      }
    }
  }

  return null;
});
