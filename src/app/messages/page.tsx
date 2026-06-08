import Link from "next/link";
import { requireUser } from "@/server/auth/guard";
import { getOrCreateOwnerConversation, listConversations } from "@/server/services/messaging";
import { NotConnected } from "@/components/not-connected";

const ROLE_TAG: Record<string, string> = { owner: "manager", employee: "handyman", tenant: "tenant" };

export default async function MessagesPage() {
  const user = await requireUser();
  let convos: Awaited<ReturnType<typeof listConversations>> = [];
  let dbReady = true;
  try {
    if (user.role === "tenant") await getOrCreateOwnerConversation(user.id).catch(() => {});
    convos = await listConversations(user.id);
  } catch {
    dbReady = false;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="text-sm opacity-60">Your conversations.</p>
      </div>
      {!dbReady ? (
        <NotConnected />
      ) : convos.length === 0 ? (
        <p className="text-sm opacity-60">No conversations yet.</p>
      ) : (
        <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
          {convos.map(({ conversation, other, last }) => (
            <li key={conversation.id}>
              <Link
                href={`/messages/${conversation.id}`}
                className="flex items-center justify-between gap-4 p-4 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <div className="min-w-0">
                  <div className="font-medium">{other?.fullName ?? other?.email ?? "Conversation"}</div>
                  <div className="truncate text-sm opacity-60">{last?.body ?? "No messages yet"}</div>
                </div>
                <span className="shrink-0 rounded-full bg-zinc-500/15 px-2 py-0.5 text-xs">
                  {other ? ROLE_TAG[other.role] ?? other.role : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
