import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { getThread } from "@/server/services/messaging";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ messages: [] }, { status: 401 });
  const { conversationId } = await params;
  const thread = await getThread(user.id, conversationId);
  if (!thread) return NextResponse.json({ messages: [] }, { status: 404 });
  return NextResponse.json({
    messages: thread.messages.map((m) => ({ id: m.id, body: m.body, senderId: m.senderId })),
  });
}
