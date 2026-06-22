import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/guard";
import { getConversationJob, getThread } from "@/server/services/messaging";
import { ChatThread } from "@/components/chat/chat-thread";

export default async function Thread({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const user = await requireUser();
  const thread = await getThread(user.id, conversationId);
  if (!thread) notFound();
  const job = await getConversationJob(user.id, conversationId);

  return (
    <div className="mx-auto max-w-2xl">
      <ChatThread
        conversationId={conversationId}
        meId={user.id}
        title={thread.otherName}
        role={user.role}
        job={job}
        messages={thread.messages.map((m) => ({ id: m.id, body: m.body, senderId: m.senderId }))}
      />
    </div>
  );
}
