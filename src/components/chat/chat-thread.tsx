"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { sendMessageAction } from "@/actions/messaging";

export interface ChatMessage {
  id: string;
  body: string;
  senderId: string;
}

export function ChatThread({
  conversationId,
  meId,
  title,
  messages,
}: {
  conversationId: string;
  meId: string;
  title: string;
  messages: ChatMessage[];
}) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [msgs, setMsgs] = useState<ChatMessage[]>(messages);
  const endRef = useRef<HTMLDivElement>(null);

  // sync when the server component re-renders with fresh messages
  useEffect(() => setMsgs(messages), [messages]);

  // light polling for incoming messages (AppSync Events is the production upgrade)
  useEffect(() => {
    let alive = true;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/conversations/${conversationId}/messages`);
        if (r.ok) {
          const j = (await r.json()) as { messages: ChatMessage[] };
          if (alive) setMsgs(j.messages);
        }
      } catch {
        /* ignore */
      }
    }, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [conversationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView();
  }, [msgs.length]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = String(new FormData(form).get("body") ?? "").trim();
    if (!body) return;
    setSending(true);
    form.reset();
    await sendMessageAction(conversationId, body);
    setSending(false);
    router.refresh();
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-xl border border-black/10 dark:border-white/15">
      <div className="border-b border-black/10 p-3 font-medium dark:border-white/15">{title}</div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {msgs.length === 0 && <p className="text-sm opacity-50">No messages yet. Say hello.</p>}
        {msgs.map((m) => (
          <div
            key={m.id}
            className={
              "max-w-[75%] rounded-2xl px-3 py-1.5 text-sm " +
              (m.senderId === meId
                ? "ml-auto bg-foreground text-background"
                : "mr-auto bg-black/5 dark:bg-white/10")
            }
          >
            {m.body}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={onSubmit} className="flex gap-2 border-t border-black/10 p-3 dark:border-white/15">
        <input
          name="body"
          autoComplete="off"
          placeholder="Message…"
          className="flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20"
        />
        <button
          disabled={sending}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </div>
  );
}
