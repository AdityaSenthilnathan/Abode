"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SendHorizontal } from "lucide-react";
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
    <div className="flex h-[70vh] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="border-b border-line bg-surface-2/50 px-4 py-3 font-semibold">{title}</div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {msgs.length === 0 && <p className="text-sm text-muted">No messages yet. Say hello.</p>}
        {msgs.map((m) => (
          <div
            key={m.id}
            className={
              "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm " +
              (m.senderId === meId
                ? "ml-auto rounded-br-md bg-brand text-brand-foreground"
                : "mr-auto rounded-bl-md bg-surface-2")
            }
          >
            {m.body}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={onSubmit} className="flex gap-2 border-t border-line p-3">
        <input
          name="body"
          autoComplete="off"
          placeholder="Message…"
          className="flex-1 rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-brand"
        />
        <button
          disabled={sending}
          aria-label="Send"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground transition hover:brightness-110 disabled:opacity-60"
        >
          <SendHorizontal className="h-[18px] w-[18px]" />
        </button>
      </form>
    </div>
  );
}
