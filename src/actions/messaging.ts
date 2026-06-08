"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/guard";
import { sendMessage } from "@/server/services/messaging";

export async function sendMessageAction(conversationId: string, body: string) {
  const user = await requireUser();
  const trimmed = body.trim();
  if (trimmed) await sendMessage(user.id, conversationId, trimmed);
  revalidatePath(`/messages/${conversationId}`);
}
