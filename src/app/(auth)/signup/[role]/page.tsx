import { notFound } from "next/navigation";
import { SignupForm } from "@/components/auth/signup-form";
import type { Role } from "@/server/auth/session";

const VALID: Role[] = ["owner", "employee", "tenant"];
const TITLE: Record<Role, string> = {
  owner: "Property Manager",
  employee: "Maintenance",
  tenant: "Tenant",
};

export default async function SignupRolePage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!VALID.includes(role as Role)) notFound();
  const r = role as Role;
  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center gap-6 px-6 py-24">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Create your {TITLE[r]} account</h1>
        <p className="text-sm opacity-60">Takes a minute.</p>
      </div>
      <SignupForm role={r} />
    </div>
  );
}
