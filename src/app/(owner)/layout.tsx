import type { ReactNode } from "react";
import { assertRole } from "@/server/auth/guard";
import { AppShell } from "@/components/app-shell";
import { navForRole } from "@/server/auth/nav";

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  const user = await assertRole("owner");
  return (
    <AppShell user={user} nav={navForRole("owner")}>
      {children}
    </AppShell>
  );
}
