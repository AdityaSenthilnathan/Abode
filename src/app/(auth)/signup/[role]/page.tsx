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
    <div className="animate-fade-up w-full max-w-md">
      <div className="glass-strong rounded-3xl p-8 shadow-2xl shadow-brand/10 sm:p-10">
        <div className="mb-6 space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Create your {TITLE[r]} account</h1>
          <p className="text-sm text-muted">Takes a minute.</p>
        </div>
        <SignupForm role={r} />
      </div>
    </div>
  );
}
