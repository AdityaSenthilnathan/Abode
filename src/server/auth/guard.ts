import "server-only";
import { redirect } from "next/navigation";
import { authLog } from "@/server/config";
import { getCurrentUser, type Role, type SessionUser } from "./session";

export type { Role, SessionUser } from "./session";

/** The landing route for each role. */
export function roleHome(role: Role): string {
  switch (role) {
    case "owner":
      return "/dashboard";
    case "employee":
      return "/jobs";
    case "tenant":
      return "/home";
  }
}

/** Require any authenticated user, else redirect to login. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    authLog("requireUser — NO session → redirecting to /login");
    redirect("/login");
  }
  return user;
}

/**
 * Require a user of a specific role. Wrong-role users are bounced to their own
 * home. Called at the top of each role's route-group layout — the coarse gate
 * before per-action checks and Postgres RLS.
 */
export async function assertRole(role: Role): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== role) {
    authLog("assertRole — page wants", role, "but session is", user.role, "→ redirecting to", roleHome(user.role));
    redirect(roleHome(user.role));
  }
  authLog("assertRole — OK:", user.role, user.email);
  return user;
}
