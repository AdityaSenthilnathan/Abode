import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { assertRole } from "@/server/auth/guard";
import { NewRequestForm } from "@/components/tenant/new-request-form";
import { Card } from "@/components/ui";

export default async function NewRequestPage() {
  await assertRole("tenant");
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link href="/requests" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Requests
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">New maintenance request</h1>
        <p className="mt-1 text-sm text-muted">Add photos or a video so the manager can see the issue.</p>
      </div>
      <Card className="p-5">
        <NewRequestForm />
      </Card>
    </div>
  );
}
