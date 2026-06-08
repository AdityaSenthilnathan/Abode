import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { users } from "@db/schema";
import { config } from "@/server/config";

export type Role = "owner" | "employee" | "tenant";

export interface SessionUser {
  id: string;
  role: Role;
  email: string;
  fullName: string | null;
}

/**
 * Resolve the current authenticated user, or null.
 *
 * DEV SHIM: until Cognito is wired (M1), a non-production `abode_dev_user`
 * cookie names which seeded user you are. This path is hard-disabled in
 * production. Reads go through the master connection (RLS bypassed) — safe,
 * since this is just the identity lookup.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  if (process.env.NODE_ENV !== "production") {
    const devId = (await cookies()).get("abode_dev_user")?.value;
    if (devId && config.db.url) {
      try {
        const [u] = await db.select().from(users).where(eq(users.id, devId)).limit(1);
        if (u) return { id: u.id, role: u.role, email: u.email, fullName: u.fullName };
      } catch {
        // DB not provisioned yet — fall through to logged-out.
      }
    }
    return null;
  }

  // TODO(M1): real Cognito session via @aws-amplify/adapter-nextjs.
  return null;
}
