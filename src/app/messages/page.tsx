import { MessageSquare } from "lucide-react";
import { requireUser } from "@/server/auth/guard";
import { getOrCreateOwnerConversation, listConversationsForUser } from "@/server/services/messaging";
import { NotConnected } from "@/components/not-connected";
import { EmptyState } from "@/components/ui";
import { MessagesList, type SelectedJob } from "@/components/messages/messages-list";
import { AutoRefresh } from "@/components/auto-refresh";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  const { job } = await searchParams;
  const user = await requireUser();
  let convos: Awaited<ReturnType<typeof listConversationsForUser>> = [];
  let dbReady = true;
  try {
    if (user.role === "tenant") await getOrCreateOwnerConversation(user.id).catch(() => {});
    convos = await listConversationsForUser(user.id, user.role);
  } catch {
    dbReady = false;
  }

  const selectedConvos = job ? convos.filter((c) => c.taskId === job) : [];
  const selected: SelectedJob | null =
    job && selectedConvos.length > 0
      ? {
          taskId: job,
          title: selectedConvos.find((c) => c.taskTitle)?.taskTitle ?? "this job",
          conversationIds: selectedConvos.map((c) => c.id),
        }
      : null;

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-1 text-sm text-muted">Your conversations.</p>
      </div>
      {!dbReady ? (
        <NotConnected />
      ) : convos.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No conversations yet"
          hint="Messages with your manager and tenants will appear here."
        />
      ) : (
        <MessagesList items={convos} selected={selected} role={user.role} />
      )}
    </div>
  );
}
