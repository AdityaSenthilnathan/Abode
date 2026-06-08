import type { ReactNode } from "react";
import { assertRole } from "@/server/auth/guard";
import { AppShell } from "@/components/app-shell";

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  const user = await assertRole("owner");
  return (
    <AppShell user={user} nav={[{ href: "/dashboard", label: "Dashboard" }]}>
      {children}
    </AppShell>
  );
}
