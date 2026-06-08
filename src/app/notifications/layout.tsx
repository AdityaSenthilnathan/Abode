import type { ReactNode } from "react";
import { requireUser } from "@/server/auth/guard";
import { AppShell } from "@/components/app-shell";
import { navForRole } from "@/server/auth/nav";

export default async function NotificationsLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell user={user} nav={navForRole(user.role)}>
      {children}
    </AppShell>
  );
}
