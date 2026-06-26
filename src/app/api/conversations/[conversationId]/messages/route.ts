import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { getConversationJob, getThread } from "@/server/services/messaging";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ messages: [], job: null }, { status: 401 });
  const { conversationId } = await params;
  // Return the job alongside messages so the in-chat workflow bar (estimate →
  // approve → complete → sign-off) stays live — the owner's Approve/Accept
  // buttons appear without a reload, on the same 3s cadence as messages.
  const [thread, job] = await Promise.all([
    getThread(user.id, conversationId),
    getConversationJob(user.id, conversationId),
  ]);
  if (!thread) return NextResponse.json({ messages: [], job: null }, { status: 404 });
  return NextResponse.json({
    messages: thread.messages.map((m) => ({
      id: m.id,
      body: m.body,
      senderId: m.senderId,
      deliveredAt: m.deliveredAt ? new Date(m.deliveredAt).toISOString() : null,
      readAt: m.readAt ? new Date(m.readAt).toISOString() : null,
    })),
    job,
  });
}
