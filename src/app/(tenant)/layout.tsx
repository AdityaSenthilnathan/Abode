import type { ReactNode } from "react";
import { assertRole } from "@/server/auth/guard";
import { AppShell } from "@/components/app-shell";

export default async function TenantLayout({ children }: { children: ReactNode }) {
  const user = await assertRole("tenant");
  return (
    <AppShell user={user} nav={[{ href: "/home", label: "Home" }]}>
      {children}
    </AppShell>
  );
}
