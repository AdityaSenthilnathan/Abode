import { assertRole } from "@/server/auth/guard";
import { NewRequestForm } from "@/components/tenant/new-request-form";

export default async function NewRequestPage() {
  await assertRole("tenant");
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New maintenance request</h1>
        <p className="text-sm opacity-60">Add photos or a video so the manager can see the issue.</p>
      </div>
      <NewRequestForm />
    </div>
  );
}
