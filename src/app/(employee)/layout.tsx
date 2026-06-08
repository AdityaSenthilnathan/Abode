import type { ReactNode } from "react";
import { assertRole } from "@/server/auth/guard";
import { AppShell } from "@/components/app-shell";
import { navForRole } from "@/server/auth/nav";

export default async function EmployeeLayout({ children }: { children: ReactNode }) {
  const user = await assertRole("employee");
  return (
    <AppShell user={user} nav={navForRole("employee")}>
      {children}
    </AppShell>
  );
}
