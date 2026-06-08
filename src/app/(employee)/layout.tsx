import type { ReactNode } from "react";
import { assertRole } from "@/server/auth/guard";
import { AppShell } from "@/components/app-shell";

export default async function EmployeeLayout({ children }: { children: ReactNode }) {
  const user = await assertRole("employee");
  return (
    <AppShell user={user} nav={[{ href: "/jobs", label: "Jobs" }]}>
      {children}
    </AppShell>
  );
}
