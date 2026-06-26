import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/guard";
import { getConversationJob, getThread } from "@/server/services/messaging";
import { ChatThread } from "@/components/chat/chat-thread";

export default async function Thread({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<{ draft?: string }>;
}) {
  const { conversationId } = await params;
  const { draft } = await searchParams;
  const user = await requireUser();
  // Independent reads on separate pooled connections — fetch concurrently.
  const [thread, job] = await Promise.all([
    getThread(user.id, conversationId),
    getConversationJob(user.id, conversationId),
  ]);
  if (!thread) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <ChatThread
        conversationId={conversationId}
        meId={user.id}
        title={thread.otherName}
        role={user.role}
        conversationType={thread.conversation.type}
        initialDraft={draft}
        job={job}
        messages={thread.messages.map((m) => ({
          id: m.id,
          body: m.body,
          senderId: m.senderId,
          deliveredAt: m.deliveredAt ? new Date(m.deliveredAt).toISOString() : null,
          readAt: m.readAt ? new Date(m.readAt).toISOString() : null,
        }))}
      />
    </div>
  );
}
